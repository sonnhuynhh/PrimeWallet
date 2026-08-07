package com.sonnhuynhh.primewallet.wallet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.math.BigInteger;

/**
 * Kết quả ước tính gas — dùng cho preview phí trước khi gửi.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EstimateGasResponse {
    private BigInteger gasLimit;      // gas units
    private BigInteger gasPriceWei;   // gas price (wei/gas)
    private BigInteger totalFeeWei;   // gasLimit * gasPrice
    private BigDecimal totalFeeEth;   // quy đổi sang coin gốc (ETH/BNB/POL)
    private String nativeSymbol;
}