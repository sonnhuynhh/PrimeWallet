package com.sonnhuynhh.primewallet.auth.controller;

import com.sonnhuynhh.primewallet.auth.dto.AdminStatsResponse;
import com.sonnhuynhh.primewallet.auth.dto.AdminUserDetailResponse;
import com.sonnhuynhh.primewallet.auth.dto.AdminUserResponse;
import com.sonnhuynhh.primewallet.auth.dto.UpdateKycRequest;
import com.sonnhuynhh.primewallet.wallet.dto.AccountResponse;
import com.sonnhuynhh.primewallet.wallet.dto.TransactionResponse;
import com.sonnhuynhh.primewallet.auth.service.AdminService;
import com.sonnhuynhh.primewallet.common.dto.ApiResponse;
import com.sonnhuynhh.primewallet.wallet.entity.DailyReport;
import com.sonnhuynhh.primewallet.wallet.service.ReconciliationService;
import com.sonnhuynhh.primewallet.wallet.service.EtherscanService;
import com.sonnhuynhh.primewallet.wallet.dto.EtherscanResponse;
import com.sonnhuynhh.primewallet.wallet.enums.BlockchainNetwork;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;

import com.sonnhuynhh.primewallet.common.dto.AuditLogResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Controller dành riêng cho Admin — Quản lý User & KYC.
 *
 * Base URL: /api/v1/admin
 *
 * Bảo mật 2 lớp:
 * 1. SecurityConfig: .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
 *    → Chặn tất cả request không có role ADMIN ở tầng Security Filter
 *
 * 2. @PreAuthorize("hasRole('ADMIN')") trên class:
 *    → Lớp bảo vệ thứ 2 ở tầng Method Security
 *    → Nếu ai đó bypass được SecurityConfig (hiếm khi xảy ra),
 *       @PreAuthorize vẫn chặn lại.
 *    → Defense in Depth (Bảo vệ theo chiều sâu) — nguyên tắc bảo mật quan trọng.
 *
 * Endpoints:
 * - GET  /users         → Danh sách user (phân trang)
 * - GET  /users/{id}    → Chi tiết 1 user
 * - PUT  /users/{id}/kyc    → Cập nhật KYC
 * - PUT  /users/{id}/lock   → Khóa tài khoản
 * - PUT  /users/{id}/unlock → Mở khóa tài khoản
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;
    private final ReconciliationService reconciliationService;
    private final EtherscanService etherscanService;

    /**
     * Lấy danh sách tất cả user (phân trang).
     *
     * GET /api/v1/admin/users?page=0&size=20
     *
     * @PageableDefault: Nếu client không truyền page/size → mặc định page=0, size=20.
     * Kết quả trả về bao gồm: content (danh sách), totalElements, totalPages.
     */
    @GetMapping("/users")
    public ResponseEntity<ApiResponse<Page<AdminUserResponse>>> getAllUsers(
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<AdminUserResponse> users = adminService.getAllUsers(pageable, q);
        return ResponseEntity.ok(ApiResponse.success("Danh sách người dùng", users));
    }

    /**
     * Lấy danh sách audit logs.
     * Có thể lọc theo user cụ thể hoặc tìm theo từ khóa (hành động / chi tiết).
     */
    @GetMapping("/logs")
    public ResponseEntity<ApiResponse<Page<AuditLogResponse>>> getAuditLogs(
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 50, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<AuditLogResponse> logs = adminService.getAuditLogs(pageable, userId, q);
        return ResponseEntity.ok(ApiResponse.success("Lịch sử hệ thống", logs));
    }

    /**
     * Lấy toàn bộ giao dịch trên hệ thống (phân trang).
     *
     * GET /api/v1/admin/transactions?page=0&size=20
     * GET /api/v1/admin/transactions?q=TXN2026          → tìm theo mã / số ví / mô tả
     * GET /api/v1/admin/transactions?type=TOPUP&status=SUCCESS → lọc theo loại + trạng thái
     *
     * Đọc-only. Sắp xếp mặc định theo createdAt mới nhất trước.
     */
    @GetMapping("/transactions")
    public ResponseEntity<ApiResponse<Page<TransactionResponse>>> getAllTransactions(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<TransactionResponse> transactions = adminService.getAllTransactions(pageable, q, type, status);
        return ResponseEntity.ok(ApiResponse.success("Danh sách giao dịch", transactions));
    }

    /**
     * Thống kê toàn hệ thống (đọc-only).
     *
     * GET /api/v1/admin/stats
     */
    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<AdminStatsResponse>> getStats() {
        AdminStatsResponse stats = adminService.getStats();
        return ResponseEntity.ok(ApiResponse.success("Thống kê hệ thống", stats));
    }

    /**
     * Xem chi tiết 1 user.
     *
     * GET /api/v1/admin/users/{id}
     *
     * @PathVariable: Lấy giá trị {id} từ URL path.
     * Ví dụ: GET /api/v1/admin/users/550e8400-e29b-41d4-a716-446655440000
     */
    @GetMapping("/users/{id}")
    public ResponseEntity<ApiResponse<AdminUserResponse>> getUserById(@PathVariable UUID id) {
        AdminUserResponse user = adminService.getUserById(id);
        return ResponseEntity.ok(ApiResponse.success("Thông tin người dùng", user));
    }

    /**
     * Chi tiết user: hồ sơ + ví + giao dịch gần đây + risk AI.
     *
     * GET /api/v1/admin/users/{id}/detail
     */
    @GetMapping("/users/{id}/detail")
    public ResponseEntity<ApiResponse<AdminUserDetailResponse>> getUserDetail(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Chi tiết người dùng", adminService.getUserDetail(id)));
    }

    /**
     * Danh sách ví Fiat của user.
     *
     * GET /api/v1/admin/users/{id}/accounts
     */
    @GetMapping("/users/{id}/accounts")
    public ResponseEntity<ApiResponse<List<AccountResponse>>> getUserAccounts(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Danh sách ví", adminService.getUserAccounts(id)));
    }

    /**
     * Cập nhật trạng thái KYC cho user.
     *
     * PUT /api/v1/admin/users/{id}/kyc
     * Body: { "kycStatus": "VERIFIED", "note": "Đã xác thực CCCD" }
     *
     * Trạng thái hợp lệ: PENDING, VERIFIED, REJECTED
     */
    @PutMapping("/users/{id}/kyc")
    public ResponseEntity<ApiResponse<AdminUserResponse>> updateKycStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateKycRequest request) {
        AdminUserResponse user = adminService.updateKycStatus(id, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật KYC thành công", user));
    }

    /**
     * Khóa tài khoản user.
     *
     * PUT /api/v1/admin/users/{id}/lock
     * Không cần request body — chỉ cần ID trong URL.
     */
    @PutMapping("/users/{id}/lock")
    public ResponseEntity<ApiResponse<AdminUserResponse>> lockUser(@PathVariable UUID id) {
        AdminUserResponse user = adminService.lockUser(id);
        return ResponseEntity.ok(ApiResponse.success("Đã khóa tài khoản", user));
    }

    /**
     * Mở khóa tài khoản user.
     *
     * PUT /api/v1/admin/users/{id}/unlock
     */
    @PutMapping("/users/{id}/unlock")
    public ResponseEntity<ApiResponse<AdminUserResponse>> unlockUser(@PathVariable UUID id) {
        AdminUserResponse user = adminService.unlockUser(id);
        return ResponseEntity.ok(ApiResponse.success("Đã mở khóa tài khoản", user));
    }

    /**
     * Chạy đối soát thủ công cho một ngày cụ thể (Dành cho Admin).
     * Nếu không truyền tham số date, tự động lấy ngày hôm nay.
     */
    @PostMapping("/reconcile")
    public ResponseEntity<ApiResponse<DailyReport>> runManualReconciliation(
            @RequestParam(required = false) String dateStr) {
        LocalDate date = (dateStr != null && !dateStr.isEmpty())
                ? LocalDate.parse(dateStr)
                : LocalDate.now();

        DailyReport report = reconciliationService.runReconciliationForDate(date);
        return ResponseEntity.ok(ApiResponse.success("Đối soát hoàn tất", report));
    }

    /**
     * Báo cáo gian lận / rủi ro từ AI microservice.
     *
     * GET /api/v1/admin/fraud-report?minLevel=MEDIUM&limit=100
     */
    @GetMapping("/fraud-report")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getFraudReport(
            @RequestParam(required = false, defaultValue = "SAFE") String minLevel,
            @RequestParam(required = false, defaultValue = "100") int limit) {
        Map<String, Object> report = adminService.getFraudReport(minLevel, limit);
        return ResponseEntity.ok(ApiResponse.success("Báo cáo gian lận", report));
    }

    /**
     * Điểm rủi ro AI của một user cụ thể.
     *
     * GET /api/v1/admin/users/{id}/risk-score
     */
    @GetMapping("/users/{id}/risk-score")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getUserRiskScore(@PathVariable UUID id) {
        Map<String, Object> risk = adminService.getUserRiskScore(id);
        return ResponseEntity.ok(ApiResponse.success("Điểm rủi ro người dùng", risk));
    }

    /**
     * Tra cứu lịch sử giao dịch Crypto qua Etherscan V2 (cần {@code etherscan.api-key}).
     */
    @GetMapping("/crypto/history")
    public ResponseEntity<ApiResponse<EtherscanResponse>> getCryptoHistory(
            @RequestParam String address,
            @RequestParam(defaultValue = "eth_sepolia") String network) {
        var blockchainNetwork = BlockchainNetwork.fromIdWithLegacy(network);
        EtherscanResponse response = etherscanService.getTransactionHistory(address, blockchainNetwork);
        return ResponseEntity.ok(ApiResponse.success("Lịch sử giao dịch ví", response));
    }
}
