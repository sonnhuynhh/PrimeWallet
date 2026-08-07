package com.sonnhuynhh.primewallet.payment.enums;

/**
 * Trạng thái của một đơn thanh toán VNPAY (PaymentOrder).
 *
 * PENDING  : Đã tạo URL thanh toán, đang chờ VNPAY xác nhận (IPN).
 * SUCCESS  : IPN báo thành công VÀ đã nạp tiền vào ví thành công.
 * FAILED   : VNPAY đã thu tiền (hoặc callback về) nhưng KHÔNG thể nạp vào ví
 *            (VD: tài khoản bị khóa, chưa KYC, số tiền không khớp).
 *            → Admin phải đối soát và xử lý tay. TIỀN KHÔNG ĐƯỢC PHÉP MẤT.
 * CANCELLED: Người dùng hủy hoặc VNPAY báo thất bại (responseCode != 00).
 */
public enum PaymentOrderStatus {
    PENDING,
    SUCCESS,
    FAILED,
    CANCELLED
}
