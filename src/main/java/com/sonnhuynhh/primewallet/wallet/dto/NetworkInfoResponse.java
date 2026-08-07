package com.sonnhuynhh.primewallet.wallet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Thông tin mạng blockchain để UI hiển thị danh sách mạng có thể chọn.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NetworkInfoResponse {
    private String id;            // eth_sepolia
    private String label;         // "Ethereum Sepolia"
    private String nativeSymbol;  // ETH
    private Long chainId;
    private boolean testnet;
    private String explorerUrl;
    /** RPC URL do server quản lý — client dùng để ký offline (tránh RPC cứng trong frontend). */
    private String rpcUrl;
}