package com.sonnhuynhh.primewallet.wallet.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * DTO yêu cầu nạp tiền vào ví.
 *
 * Luồng nạp tiền:
 * 1. User chọn "Nạp tiền" trên app
 * 2. Nhập số tiền muốn nạp
 * 3. Client tạo UUID idempotencyKey và gửi kèm request
 * 4. Server tạo Transaction (TOPUP) + 1 LedgerEntry (CREDIT)
 * 5. Cộng tiền vào balance của ví
 *
 * Lưu ý: Trong môi trường thật, nạp tiền cần tích hợp với cổng thanh toán
 * (VNPay, Momo, ...). Ở Sprint 1 ta giả lập (simulate) việc nạp tiền.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TopUpRequest {

    /**
     * Khóa chống giao dịch trùng lặp.
     * Client phải tạo UUID mới cho mỗi lần nạp tiền.
     */
    @NotNull(message = "Idempotency key không được để trống")
    private UUID idempotencyKey;

    /**
     * Số tiền muốn nạp. Phải lớn hơn 0.
     */
    @NotNull(message = "Số tiền không được để trống")
    @DecimalMin(value = "1000", message = "Số tiền nạp tối thiểu là 1.000đ")
    private BigDecimal amount;

    /**
     * Ghi chú nạp tiền (tùy chọn).
     */
    private String description;
}
