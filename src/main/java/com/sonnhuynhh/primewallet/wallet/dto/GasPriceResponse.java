package com.sonnhuynhh.primewallet.wallet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigInteger;

/**
 * Gas price hiện tại của một mạng.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GasPriceResponse {
    private String blockchainNetwork;
    private BigInteger gasPriceWei;
    private String nativeSymbol;
}