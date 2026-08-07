package com.sonnhuynhh.primewallet.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * DTO trả về thống kê toàn hệ thống — dành cho trang Quản trị.
 *
 * Gồm 2 nhóm:
 * - Số lượng tổng (user, ví, giao dịch) — tồn tại từ khi hệ thống bắt đầu.
 * - Tổng tiền giao dịch thành công HÔM NAY theo loại (TOPUP, WITHDRAW, TRANSFER).
 *
 * Đọc-only — admin chỉ XEM, không có thao tác nào ở đây thay đổi số dư.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminStatsResponse {

    /** Tổng số người dùng trong hệ thống. */
    private long totalUsers;

    /** Tổng số ví (account) đã tạo. */
    private long totalAccounts;

    /** Tổng số giao dịch đã ghi nhận. */
    private long totalTransactions;

    /** Tổng tiền nạp (TOPUP) thành công hôm nay. */
    private BigDecimal totalTopUp;

    /** Tổng tiền rút (WITHDRAW) thành công hôm nay. */
    private BigDecimal totalWithdraw;

    /** Tổng tiền chuyển nội bộ (TRANSFER) thành công hôm nay. */
    private BigDecimal totalTransfer;
}