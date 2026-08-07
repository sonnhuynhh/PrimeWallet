package com.sonnhuynhh.primewallet.wallet.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BroadcastTransactionRequest {
    @NotBlank(message = "Signed transaction hex cannot be empty")
    private String signedTransactionHex;
}
