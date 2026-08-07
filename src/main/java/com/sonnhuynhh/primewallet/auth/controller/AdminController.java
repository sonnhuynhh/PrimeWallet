package com.sonnhuynhh.primewallet.auth.controller;

import com.sonnhuynhh.primewallet.auth.dto.AdminStatsResponse;
import com.sonnhuynhh.primewallet.auth.dto.AdminUserResponse;
import com.sonnhuynhh.primewallet.auth.dto.UpdateKycRequest;
import com.sonnhuynhh.primewallet.wallet.dto.TransactionResponse;
import com.sonnhuynhh.primewallet.auth.service.AdminService;
import com.sonnhuynhh.primewallet.common.dto.ApiResponse;
import com.sonnhuynhh.primewallet.wallet.entity.DailyReport;
import com.sonnhuynhh.primewallet.wallet.service.ReconciliationService;
import com.sonnhuynhh.primewallet.wallet.service.EtherscanService;
import com.sonnhuynhh.primewallet.wallet.dto.EtherscanResponse;
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
            @PageableDefault(size = 20) Pageable pageable) {
        Page<AdminUserResponse> users = adminService.getAllUsers(pageable);
        return ResponseEntity.ok(ApiResponse.success("Danh sách người dùng", users));
    }

    /**
     * Lấy danh sách audit logs.
     */
    @GetMapping("/logs")
    public ResponseEntity<ApiResponse<Page<AuditLogResponse>>> getAuditLogs(
            @RequestParam(required = false) UUID userId,
            @PageableDefault(size = 50, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<AuditLogResponse> logs = adminService.getAuditLogs(pageable, userId);
        return ResponseEntity.ok(ApiResponse.success("Lịch sử hệ thống", logs));
    }

    /**
     * Lấy toàn bộ giao dịch trên hệ thống (phân trang).
     *
     * GET /api/v1/admin/transactions?page=0&size=20
     *
     * Đọc-only. Sắp xếp mặc định theo createdAt mới nhất trước.
     */
    @GetMapping("/transactions")
    public ResponseEntity<ApiResponse<Page<TransactionResponse>>> getAllTransactions(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<TransactionResponse> transactions = adminService.getAllTransactions(pageable);
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
     * Tra cứu lịch sử giao dịch Crypto qua Etherscan.
     */
    @GetMapping("/crypto/history")
    public ResponseEntity<ApiResponse<EtherscanResponse>> getCryptoHistory(
            @RequestParam String address) {
        EtherscanResponse response = etherscanService.getTransactionHistory(address);
        return ResponseEntity.ok(ApiResponse.success("Lịch sử giao dịch ví", response));
    }
}
