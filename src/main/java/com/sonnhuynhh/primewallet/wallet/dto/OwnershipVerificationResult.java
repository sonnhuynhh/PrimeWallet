package com.sonnhuynhh.primewallet.wallet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Kết quả xác minh quyền sở hữu ví.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OwnershipVerificationResult {
    private boolean verified;
}