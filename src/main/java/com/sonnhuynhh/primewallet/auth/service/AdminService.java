package com.sonnhuynhh.primewallet.auth.service;

import com.sonnhuynhh.primewallet.auth.dto.AdminUserResponse;
import com.sonnhuynhh.primewallet.auth.dto.UpdateKycRequest;
import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException;
import com.sonnhuynhh.primewallet.common.service.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

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
    private final AuditService auditService;

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
    public Page<AdminUserResponse> getAllUsers(Pageable pageable) {
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
                String.format("Cập nhật KYC → %s, note: %s", request.getKycStatus(), request.getNote()), null);

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
