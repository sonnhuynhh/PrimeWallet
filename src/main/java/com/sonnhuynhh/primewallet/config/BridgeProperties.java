package com.sonnhuynhh.primewallet.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Cấu hình bridge bán crypto → cộng VND ví Fiat.
 *
 * <pre>
 * bridge.treasury.eth_sepolia=0x...
 * bridge.rates.eth_sepolia.ETH=65000000
 * bridge.rates.eth_sepolia.USDC=25000
 * </pre>
 */
@Configuration
@ConfigurationProperties(prefix = "bridge")
@Getter
@Setter
public class BridgeProperties {

    private boolean enabled = true;
    private int quoteTtlSeconds = 300;
    /** Cache tỷ giá CoinGecko (giây). */
    private int rateCacheSeconds = 60;
    /** Spread bridge (bps) — trừ khỏi giá thị trường. 0 = giá thị trường. */
    private int spreadBps = 0;
    /** API key CoinGecko (tuỳ chọn, tăng rate limit). */
    private String coingeckoApiKey = "";
    /** network-id → địa chỉ ví treasury nhận crypto. */
    private Map<String, String> treasury = new LinkedHashMap<>();
    /** network-id → (symbol → tỷ giá VND / 1 đơn vị token) — fallback khi CoinGecko lỗi. */
    private Map<String, Map<String, BigDecimal>> rates = new LinkedHashMap<>();
}
