package com.sonnhuynhh.primewallet.payment.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * Kết quả xác nhận thanh toán VNPAY từ Return URL (frontend gọi sau khi user quay về).
 * Khác IPN: dùng khi chạy local — VNPAY không gọi được webhook tới localhost.
 */
@Getter
@Builder
public class PaymentConfirmResult {
    /** Đã cộng tiền vào ví trong lần gọi này. */
    private final boolean credited;
    /** Đơn đã được xử lý trước đó (idempotent). */
    private final boolean alreadyProcessed;
    /** Thông báo hiển thị cho người dùng. */
    private final String message;
}
