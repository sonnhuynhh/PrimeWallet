package com.sonnhuynhh.primewallet.wallet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CryptoWalletResponse {
    private UUID id;
    private String walletAddress;
    private String blockchainNetwork;
    private LocalDateTime linkedAt;
}
