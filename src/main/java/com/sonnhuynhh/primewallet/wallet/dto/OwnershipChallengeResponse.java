package com.sonnhuynhh.primewallet.wallet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Challenge xác minh quyền sở hữu ví.
 * Client phải ký challenge bằng private key tương ứng với địa chỉ và
 * gửi lại signature để server verify.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OwnershipChallengeResponse {
    private String address;
    private String nonce;      // challenge nonce
    private String message;    // message cần ký (VD: "PrimeWallet: verify {address} at {nonce}")
    private Long expiresInSeconds;
}