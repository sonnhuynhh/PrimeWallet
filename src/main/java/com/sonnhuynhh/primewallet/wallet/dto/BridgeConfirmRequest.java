package com.sonnhuynhh.primewallet.wallet.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BridgeConfirmRequest {

    @NotBlank(message = "txHash không được để trống")
    private String txHash;
}
