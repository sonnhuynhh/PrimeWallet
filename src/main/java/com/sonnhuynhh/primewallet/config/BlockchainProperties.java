package com.sonnhuynhh.primewallet.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Cấu hình các mạng blockchain từ application.properties / application-local.properties.
 *
 * Format properties (key của map chính là id của BlockchainNetwork, VD: eth_sepolia):
 * <pre>
 * blockchain.networks.eth_sepolia.rpc-url=https://ethereum-sepolia-rpc.publicnode.com
 * blockchain.networks.eth_sepolia.chain-id=11155111
 * blockchain.networks.eth_sepolia.symbol=ETH
 * blockchain.networks.eth_mainnet.rpc-url=https://eth-mainnet.g.alchemy.com/v2/KEY
 * blockchain.networks.eth_mainnet.chain-id=1
 * blockchain.networks.bsc_testnet.rpc-url=https://data-seed-prebsc-1-s1.bnbchain.org:8545
 * blockchain.networks.bsc_testnet.chain-id=97
 * blockchain.networks.polygon_amoy.rpc-url=https://rpc-amoy.polygon.technology
 * blockchain.networks.polygon_amoy.chain-id=80002
 * </pre>
 *
 * Mỗi NetworkProperties có:
 * - rpcUrl: RPC endpoint (Web3j kết nối tới đây)
 * - chainId: Chain ID theo EIP-155 — dùng để verify phòng tránh replay attack
 * - symbol: ký hiệu token gốc (ETH, BNB, POL…)
 * - explorerUrl: link block explorer (hiển thị trong UI)
 * - etherscanApiUrl: base URL Etherscan API để tra lịch sử (nếu có)
 */
@Configuration
@ConfigurationProperties(prefix = "blockchain")
@Getter
@Setter
public class BlockchainProperties {

    /** Map network-id → NetworkConfig. Spring tự đổ config vào đây theo key. */
    private Map<String, NetworkConfig> networks = new LinkedHashMap<>();

    @Getter
    @Setter
    public static class NetworkConfig {
        private String rpcUrl;
        private Long chainId;
        private String symbol;
        private String label;
        private String explorerUrl;
        private String etherscanApiUrl;
        private boolean testnet = true;
    }
}