package com.sonnhuynhh.primewallet.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Cấu hình danh sách token ERC-20 mặc định cho từng mạng blockchain.
 *
 * Format properties:
 * <pre>
 * blockchain.tokens.eth_sepolia[0].symbol=USDT
 * blockchain.tokens.eth_sepolia[0].name=Tether USD
 * blockchain.tokens.eth_sepolia[0].decimals=6
 * blockchain.tokens.eth_sepolia[0].contract=0x...
 * </pre>
 *
 * Map key = id của {@code BlockchainNetwork}, value = danh sách token mặc định.
 */
@Configuration
@ConfigurationProperties(prefix = "blockchain")
@Getter
@Setter
public class TokenProperties {

    /** network-id → danh sách token ERC-20 mặc định */
    private Map<String, List<TokenConfig>> tokens = new LinkedHashMap<>();

    @Getter
    @Setter
    public static class TokenConfig {
        private String symbol;
        private String name;
        private int decimals;
        private String contract;
    }
}