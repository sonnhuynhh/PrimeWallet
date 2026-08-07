package com.sonnhuynhh.primewallet.wallet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WalletBalanceResponse {
    private UUID walletId;
    private String walletAddress;
    private String blockchainNetwork;   // eth_sepolia
    private String networkLabel;        // "Ethereum Sepolia"
    private BigDecimal balanceEth;      // số dư native coin (ETH/BNB/POL)
    private String balanceWei;          // số nguyên gốc (wei)
    private String nativeSymbol;        // ETH/BNB/POL
    private Long chainId;
    private List<TokenBalanceResponse> tokens; // số dư ERC-20 (nullable)
}