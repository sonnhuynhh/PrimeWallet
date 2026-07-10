package com.sonnhuynhh.primewallet.wallet.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * DTO yêu cầu chuyển tiền nội bộ giữa 2 ví PrimeWallet.
 *
 * Luồng chuyển tiền:
 * 1. User nhập số tài khoản người nhận (VD: "PW00001234")
 * 2. Client tạo UUID idempotencyKey
 * 3. Server kiểm tra: ví gửi có đủ tiền không? Ví nhận có tồn tại không?
 * 4. Tạo Transaction (TRANSFER) + 2 LedgerEntry:
 *    - DEBIT  (trừ tiền ví gửi)
 *    - CREDIT (cộng tiền ví nhận)
 * 5. Cập nhật balance cả 2 ví trong cùng 1 DB transaction
 *
 * Đây là giao dịch quan trọng nhất, yêu cầu tính ACID tuyệt đối:
 * - Atomicity: Hoặc cả 2 ví đều cập nhật, hoặc không ví nào thay đổi.
 * - Consistency: Tổng DEBIT == Tổng CREDIT.
 * - Isolation: 2 giao dịch đồng thời không xung đột (dùng Pessimistic Lock).
 * - Durability: Dữ liệu đã commit không bị mất.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransferRequest {

    @NotNull(message = "Idempotency key không được để trống")
    private UUID idempotencyKey;

    /**
     * Số tài khoản ví người nhận (VD: "PW00001234").
     */
    @NotBlank(message = "Số tài khoản người nhận không được để trống")
    private String destinationAccountNumber;

    /**
     * Số tiền chuyển. Phải lớn hơn 0.
     */
    @NotNull(message = "Số tiền không được để trống")
    @DecimalMin(value = "1000", message = "Số tiền chuyển tối thiểu là 1.000đ")
    private BigDecimal amount;

    /**
     * Nội dung chuyển khoản (VD: "Tiền ăn trưa").
     */
    private String description;
}
