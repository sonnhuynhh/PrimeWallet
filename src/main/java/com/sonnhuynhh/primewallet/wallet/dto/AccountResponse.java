package com.sonnhuynhh.primewallet.wallet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO trả về thông tin ví cho client.
 *
 * Tại sao không trả Entity trực tiếp?
 * 1. Entity chứa thông tin nhạy cảm (user object, internal ID) không nên lộ ra ngoài.
 * 2. Entity có thể thay đổi cấu trúc DB mà không ảnh hưởng API response.
 * 3. Tránh lazy loading exception khi serialize Entity sang JSON.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AccountResponse {

    private UUID id;
    private String accountNumber;
    private String currency;
    private BigDecimal balance;
    private String status;
    private String accountType;
    private LocalDateTime createdAt;
}
