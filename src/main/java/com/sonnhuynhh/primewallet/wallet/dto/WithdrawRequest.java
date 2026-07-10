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
 * DTO yêu cầu rút tiền từ ví về ngân hàng.
 *
 * Luồng rút tiền:
 * 1. User chọn "Rút tiền" → nhập số tiền
 * 2. Server kiểm tra số dư đủ không
 * 3. Tạo Transaction (WITHDRAW) + 1 LedgerEntry (DEBIT)
 * 4. Trừ tiền khỏi balance ví
 *
 * Lưu ý: Trong thực tế, sau khi tạo giao dịch PENDING,
 * hệ thống sẽ gọi API ngân hàng để chuyển tiền thật.
 * Ở Sprint 1 ta giả lập (simulate) việc rút tiền.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WithdrawRequest {

    @NotNull(message = "Idempotency key không được để trống")
    private UUID idempotencyKey;

    @NotNull(message = "Số tiền không được để trống")
    @DecimalMin(value = "10000", message = "Số tiền rút tối thiểu là 10.000đ")
    private BigDecimal amount;

    private String description;
}
