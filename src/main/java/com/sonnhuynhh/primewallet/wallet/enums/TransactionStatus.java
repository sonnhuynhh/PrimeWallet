package com.sonnhuynhh.primewallet.wallet.enums;

/**
 * Trạng thái giao dịch — Vòng đời của một giao dịch.
 *
 * Luồng bình thường:  PENDING → SUCCESS
 * Luồng lỗi:          PENDING → FAILED
 * Luồng hoàn tiền:    SUCCESS → REVERSED (tạo giao dịch đảo ngược)
 *
 * - PENDING:  Giao dịch vừa được tạo, đang chờ xử lý.
 * - SUCCESS:  Giao dịch đã hoàn tất thành công. Số dư đã được cập nhật.
 * - FAILED:   Giao dịch thất bại (VD: không đủ số dư, tài khoản bị khóa).
 * - REVERSED: Giao dịch đã được hoàn tiền (rollback bằng giao dịch đảo).
 */
public enum TransactionStatus {
    PENDING,
    SUCCESS,
    FAILED,
    REVERSED
}
