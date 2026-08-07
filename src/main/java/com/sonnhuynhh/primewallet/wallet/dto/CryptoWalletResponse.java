package com.sonnhuynhh.primewallet.wallet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Tóm tắt một ví Crypto đã liên kết (dùng trong danh sách ví).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CryptoWalletResponse {
    private UUID id;
    private String walletAddress;
    private String blockchainNetwork;
    private String label;
    private boolean primary;
    private LocalDateTime linkedAt;
}