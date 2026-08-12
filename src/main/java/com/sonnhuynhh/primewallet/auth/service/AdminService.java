package com.sonnhuynhh.primewallet.auth.service;

import com.sonnhuynhh.primewallet.auth.dto.AdminStatsResponse;
import com.sonnhuynhh.primewallet.auth.dto.AdminUserDetailResponse;
import com.sonnhuynhh.primewallet.auth.dto.AdminUserResponse;
import com.sonnhuynhh.primewallet.auth.dto.UpdateKycRequest;
import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.ai.service.AiInsightService;
import com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException;
import com.sonnhuynhh.primewallet.common.service.AuditService;
import com.sonnhuynhh.primewallet.wallet.dto.AccountResponse;
import com.sonnhuynhh.primewallet.wallet.dto.TransactionResponse;
import com.sonnhuynhh.primewallet.wallet.entity.Account;
import com.sonnhuynhh.primewallet.wallet.entity.Transaction;
import com.sonnhuynhh.primewallet.wallet.enums.TransactionStatus;
import com.sonnhuynhh.primewallet.wallet.enums.TransactionType;
import com.sonnhuynhh.primewallet.wallet.repository.AccountRepository;
import com.sonnhuynhh.primewallet.wallet.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import com.sonnhuynhh.primewallet.common.entity.AuditLog;
import com.sonnhuynhh.primewallet.common.repository.AuditLogRepository;
import com.sonnhuynhh.primewallet.common.dto.AuditLogResponse;

/**
 * Service dành riêng cho các thao tác quản trị (Admin).
 *
 * Tại sao tách riêng AdminService thay vì thêm vào AuthService?
 * → Nguyên tắc Single Responsibility Principle (SRP):
 *   - AuthService chịu trách nhiệm: đăng ký, đăng nhập, profile, đổi mật khẩu
 *     (tất cả đều là thao tác CỦA USER cho CHÍNH MÌNH).
 *   - AdminService chịu trách nhiệm: quản lý user khác, KYC, lock/unlock
 *     (thao tác CỦA ADMIN lên NGƯỜI KHÁC).
 *
 * Nếu nhồi hết vào 1 file → file quá dài, khó bảo trì.
 * Khi tách ra → mỗi file có 1 mục đích rõ ràng → dễ tìm, dễ sửa.
 *
 * @Slf4j: Tự động tạo biến `log` để ghi log quan trọng
 *         (log.info, log.warn, log.error).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminService {

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final AuditService auditService;
    private final AuditLogRepository auditLogRepository;
    private final AiInsightService aiInsightService;

    // ==================== FRAUD REPORT ====================

    /**
     * Báo cáo gian lận từ AI microservice, bổ sung email/họ tên/trạng thái từ Postgres.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getFraudReport(String minLevel, int limit) {
        Map<String, Object> report = aiInsightService.getFraudReport(minLevel, limit);
        if (Boolean.FALSE.equals(report.get("available"))) {
            return report;
        }

        Object usersObj = report.get("users");
        if (!(usersObj instanceof List<?> rawUsers)) {
            return report;
        }

        List<Map<String, Object>> enriched = new ArrayList<>();
        for (Object item : rawUsers) {
            if (!(item instanceof Map<?, ?> raw)) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>((Map<String, Object>) raw);
            String userIdStr = String.valueOf(row.getOrDefault("user_id", ""));
            try {
                UUID userId = UUID.fromString(userIdStr);
                userRepository.findById(userId).ifPresentOrElse(user -> {
                    row.put("email", user.getEmail());
                    row.put("fullName", user.getFullName());
                    row.put("phone", user.getPhone());
                    row.put("status", user.getStatus());
                    row.put("kycStatus", user.getKycStatus() != null ? user.getKycStatus().name() : null);
                    row.put("role", user.getRole() != null ? user.getRole().name() : null);
                }, () -> {
                    row.put("email", null);
                    row.put("fullName", "Không tìm thấy trong hệ thống");
                    row.put("status", null);
                });
            } catch (IllegalArgumentException ex) {
                row.put("email", null);
                row.put("fullName", "User ID không hợp lệ");
            }
            enriched.add(row);
        }

        report.put("users", enriched);
        return report;
    }

    public Map<String, Object> getUserRiskScore(UUID userId) {
        // Đảm bảo user tồn tại trước khi hỏi AI
        getUserById(userId);
        return aiInsightService.getRiskScore(userId.toString());
    }

    /**
     * Danh sách ví Fiat của user (đọc số dư từ DB).
     */
    @Transactional(readOnly = true)
    public List<AccountResponse> getUserAccounts(UUID userId) {
        getUserById(userId);
        return accountRepository.findByUserId(userId).stream()
                .map(this::toAccountResponse)
                .toList();
    }

    /**
     * Chi tiết user: hồ sơ + ví + giao dịch gần đây + risk AI.
     */
    @Transactional(readOnly = true)
    public AdminUserDetailResponse getUserDetail(UUID userId) {
        AdminUserResponse user = getUserById(userId);
        List<AccountResponse> accounts = accountRepository.findByUserId(userId).stream()
                .map(this::toAccountResponse)
                .toList();
        List<TransactionResponse> recent = transactionRepository
                .findByUserId(userId, Pageable.ofSize(15))
                .map(this::toTransactionResponse)
                .getContent();
        Map<String, Object> risk = aiInsightService.getRiskScore(userId.toString());
        return AdminUserDetailResponse.builder()
                .user(user)
                .accounts(accounts)
                .recentTransactions(recent)
                .riskScore(risk)
                .build();
    }

    private AccountResponse toAccountResponse(Account account) {
        return AccountResponse.builder()
                .id(account.getId())
                .accountNumber(account.getAccountNumber())
                .currency(account.getCurrency())
                .balance(account.getBalance())
                .status(account.getStatus() != null ? account.getStatus().name() : null)
                .accountType(account.getAccountType())
                .createdAt(account.getCreatedAt())
                .build();
    }

    // ==================== AUDIT LOGS ====================

    /**
     * Lấy danh sách audit log.
     * Có thể lọc theo user cụ thể.
     */
    public Page<AuditLogResponse> getAuditLogs(Pageable pageable, UUID userId, String q) {
        Page<AuditLog> logs;
        if (userId != null) {
            logs = auditLogRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
        } else if (q != null && !q.isBlank()) {
            logs = auditLogRepository.search(q.trim(), pageable);
        } else {
            // Không có method findAllOrderByCreatedAtDesc sẵn, ta dùng findAll rồi set sort trong Pageable ở Controller
            logs = auditLogRepository.findAll(pageable);
        }

        return logs.map(this::toAuditLogResponse);
    }
    
    private AuditLogResponse toAuditLogResponse(AuditLog log) {
        return AuditLogResponse.builder()
                .id(log.getId())
                .userId(log.getUserId())
                .action(log.getAction())
                .detail(log.getDetail())
                .ipAddress(log.getIpAddress())
                .createdAt(log.getCreatedAt())
                .build();
    }

    // ==================== GIAO DỊCH HỆ THỐNG (ĐỌC-ONLY) ====================

    /**
     * Lấy toàn bộ giao dịch trên hệ thống (có phân trang).
     *
     * Đọc-only — admin chỉ XEM. KHÔNG có thao tác nào thay đổi số dư ở đây,
     * giữ tính minh bạch và an toàn tài sản cho người dùng.
     *
     * findAll(Pageable) kế thừa từ JpaRepository: content + totalElements + totalPages.
     * Sort (mặc định createdAt DESC) được thiết lập qua Pageable từ Controller.
     *
     * @Transactional(readOnly = true): giữ Hibernate session mở trong lúc map entity → DTO.
     * sourceAccount / destinationAccount là LAZY (open-in-view=false) — nếu map bên ngoài
     * transaction sẽ ném LazyInitializationException (đã gặp lỗi này trước khi thêm annotation).
     *
     * q: từ khóa tìm kiếm (mã GD / số ví nguồn-đích / mô tả). Rỗng → lấy hết.
     * type: lọc theo loại giao dịch (TOPUP, WITHDRAW, TRANSFER, PAYMENT). Rỗng = tất cả.
     * status: lọc theo trạng thái (PENDING, SUCCESS, FAILED, REVERSED). Rỗng = tất cả.
     */
    @Transactional(readOnly = true)
    public Page<TransactionResponse> getAllTransactions(
            Pageable pageable, String q, String type, String status) {
        Page<Transaction> transactions;

        if (q != null && !q.isBlank()) {
            transactions = transactionRepository.search(q.trim(), pageable);
        } else if (type != null && !type.isBlank() && status != null && !status.isBlank()) {
            transactions = transactionRepository.findByTransactionTypeAndStatus(
                    TransactionType.valueOf(type), TransactionStatus.valueOf(status), pageable);
        } else {
            transactions = transactionRepository.findAll(pageable);
        }

        return transactions.map(this::toTransactionResponse);
    }

    /**
     * Thống kê toàn hệ thống.
     *
     * - Số lượng tổng (user / ví / giao dịch).
     * - Tổng tiền giao dịch thành công HÔM NAY theo loại.
     */
    public AdminStatsResponse getStats() {
        // Khung giờ hôm nay: [00:00:00, 00:00:00 ngày sau)
        LocalDateTime from = LocalDate.now().atStartOfDay();
        LocalDateTime to = from.plusDays(1);

        return AdminStatsResponse.builder()
                .totalUsers(userRepository.count())
                .totalAccounts(accountRepository.count())
                .totalTransactions(transactionRepository.count())
                .totalTopUp(sumToday(TransactionType.TOPUP, from, to))
                .totalWithdraw(sumToday(TransactionType.WITHDRAW, from, to))
                .totalTransfer(sumToday(TransactionType.TRANSFER, from, to))
                .build();
    }

    /**
     * Tính tổng tiền giao dịch THÀNH CÔNG hôm nay theo loại.
     * Trả về BigDecimal (0 nếu chưa có giao dịch).
     */
    private BigDecimal sumToday(TransactionType type, LocalDateTime from, LocalDateTime to) {
        return transactionRepository.sumAmountByTypeAndStatusAndDate(
                type, TransactionStatus.SUCCESS, from, to);
    }

    /**
     * Chuyển Transaction entity → TransactionResponse (chỉ để XEM).
     * Mirror của TransactionService.toResponse (private bên đó) — phải null-guard
     * source/destination vì TOPUP không có source, WITHDRAW không có destination.
     */
    private TransactionResponse toTransactionResponse(Transaction transaction) {
        return TransactionResponse.builder()
                .id(transaction.getId())
                .referenceNumber(transaction.getReferenceNumber())
                .transactionType(transaction.getTransactionType().name())
                .sourceAccountNumber(
                        transaction.getSourceAccount() != null
                                ? transaction.getSourceAccount().getAccountNumber()
                                : null)
                .destinationAccountNumber(
                        transaction.getDestinationAccount() != null
                                ? transaction.getDestinationAccount().getAccountNumber()
                                : null)
                .amount(transaction.getAmount())
                .fee(transaction.getFee())
                .currency(transaction.getCurrency())
                .description(transaction.getDescription())
                .status(transaction.getStatus().name())
                .createdAt(transaction.getCreatedAt())
                .build();
    }

    // ==================== DANH SÁCH USER ====================

    /**
     * Lấy danh sách tất cả user (có phân trang).
     *
     * Tại sao cần phân trang (Pageable)?
     * → Nếu hệ thống có 100,000 user mà load hết 1 lần → chết server.
     * → Phân trang giúp mỗi lần chỉ lấy 20 user (hoặc tuỳ chỉnh).
     *
     * Page<T> là wrapper chứa:
     * - content: Danh sách user trong trang hiện tại
     * - totalElements: Tổng số user toàn hệ thống
     * - totalPages: Tổng số trang
     * - number: Trang hiện tại (0-indexed)
     */
    public Page<AdminUserResponse> getAllUsers(Pageable pageable, String q) {
        // q rỗng → liệt kê hết; có q → tìm theo email / SĐT / họ tên
        if (q != null && !q.isBlank()) {
            return userRepository.search(q.trim(), pageable)
                    .map(this::toAdminUserResponse);
        }
        // .map() chuyển đổi từ Page<User> → Page<AdminUserResponse>
        return userRepository.findAll(pageable)
                .map(this::toAdminUserResponse);
    }

    // ==================== CHI TIẾT USER ====================

    /**
     * Xem chi tiết thông tin 1 user theo ID.
     */
    public AdminUserResponse getUserById(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng với ID: " + userId));
        return toAdminUserResponse(user);
    }

    // ==================== CẬP NHẬT KYC ====================

    /**
     * Cập nhật trạng thái KYC cho user.
     *
     * Luồng thực tế:
     * 1. User gửi CCCD/ảnh selfie qua app → Admin nhận được trong dashboard
     * 2. Admin kiểm tra giấy tờ → gọi API này với kycStatus = VERIFIED hoặc REJECTED
     * 3. Nếu VERIFIED → user được phép giao dịch lớn (> 10 triệu VNĐ)
     * 4. Nếu REJECTED → user cần gửi lại giấy tờ → admin kèm note giải thích
     *
     * Ở phase này, ta chưa có tính năng upload ảnh CCCD.
     * Chỉ xây dựng phần API cập nhật trạng thái trước.
     */
    @Transactional
    public AdminUserResponse updateKycStatus(UUID userId, UpdateKycRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng với ID: " + userId));

        // Cập nhật trạng thái KYC
        user.setKycStatus(request.getKycStatus());
        user = userRepository.save(user);

        log.info("Admin đã cập nhật KYC cho user {} → {}, note: {}",
                user.getEmail(), request.getKycStatus(), request.getNote());

        auditService.log(userId, "KYC_UPDATE",
                String.format("Cập nhật KYC cho tài khoản %s → %s, note: %s", user.getEmail(), request.getKycStatus(), request.getNote()), null);

        return toAdminUserResponse(user);
    }

    // ==================== KHÓA / MỞ KHÓA TÀI KHOẢN ====================

    /**
     * Khóa tài khoản user.
     *
     * Khi bị khóa (LOCKED):
     * → User KHÔNG thể thực hiện bất kỳ giao dịch nào (nạp, rút, chuyển)
     * → User VẪN có thể đăng nhập (để xem thông tin, liên hệ hỗ trợ)
     *
     * Trường hợp sử dụng:
     * - Phát hiện hoạt động gian lận (fraud detection)
     * - User yêu cầu khóa tài khoản tạm thời (đi du lịch, mất điện thoại)
     * - Vi phạm điều khoản sử dụng
     */
    @Transactional
    public AdminUserResponse lockUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng với ID: " + userId));

        // Kiểm tra trạng thái hiện tại — tránh lock user đã bị lock
        if ("LOCKED".equals(user.getStatus())) {
            throw new IllegalArgumentException("Tài khoản đã bị khóa từ trước");
        }

        user.setStatus("LOCKED");
        user = userRepository.save(user);

        log.warn("⚠️ Admin đã KHÓA tài khoản user: {}", user.getEmail());

        auditService.log(userId, "LOCK_USER",
                "Khóa tài khoản: " + user.getEmail(), null);

        return toAdminUserResponse(user);
    }

    /**
     * Mở khóa tài khoản user.
     *
     * Khi mở khóa → user trở lại trạng thái ACTIVE → được giao dịch bình thường.
     */
    @Transactional
    public AdminUserResponse unlockUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng với ID: " + userId));

        if ("ACTIVE".equals(user.getStatus())) {
            throw new IllegalArgumentException("Tài khoản đang hoạt động bình thường, không cần mở khóa");
        }

        user.setStatus("ACTIVE");
        user = userRepository.save(user);

        log.info("✅ Admin đã MỞ KHÓA tài khoản user: {}", user.getEmail());

        auditService.log(userId, "UNLOCK_USER",
                "Mở khóa tài khoản: " + user.getEmail(), null);

        return toAdminUserResponse(user);
    }

    // ==================== HELPER ====================

    /**
     * Chuyển đổi Entity User → DTO AdminUserResponse.
     *
     * Tại sao đặt thành method riêng (private)?
     * → Vì logic mapping này được dùng lại ở NHIỀU nơi
     *   (getAllUsers, getUserById, updateKyc, lock, unlock).
     * → Nếu copy-paste → khi thêm trường mới phải sửa 5 chỗ → dễ quên.
     * → Tách method → sửa 1 chỗ, tất cả đều cập nhật → DRY principle.
     */
    private AdminUserResponse toAdminUserResponse(User user) {
        return AdminUserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .phone(user.getPhone())
                .fullName(user.getFullName())
                .dateOfBirth(user.getDateOfBirth())
                .role(user.getRole())
                .kycStatus(user.getKycStatus())
                .status(user.getStatus())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}
