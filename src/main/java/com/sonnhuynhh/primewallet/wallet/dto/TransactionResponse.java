package com.sonnhuynhh.primewallet.wallet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO trả về thông tin giao dịch cho client.
 *
 * Hiển thị trên giao diện lịch sử giao dịch:
 * "Chuyển tiền | -100.000đ | Cho: PW00001234 | TXN20260711001234 | Thành công"
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransactionResponse {

    private UUID id;
    private String referenceNumber;
    private String transactionType;
    private String sourceAccountNumber;
    private String destinationAccountNumber;
    private BigDecimal amount;
    private BigDecimal fee;
    private String currency;
    private String description;
    private String status;
    private LocalDateTime createdAt;
}
