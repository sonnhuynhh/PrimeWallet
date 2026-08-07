package com.sonnhuynhh.primewallet.wallet.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class LinkWalletRequest {

    @NotBlank(message = "Wallet address is required")
    @Pattern(regexp = "^0x[a-fA-F0-9]{40}$", message = "Invalid Ethereum wallet address format")
    private String walletAddress;

    @NotBlank(message = "Blockchain network is required")
    private String blockchainNetwork; // e.g. "ETH_SEPOLIA"

    // To properly prove ownership, we would need a signed message and signature here.
    // For this implementation, we will keep it simple.
    // private String message;
    // private String signature;
}
