package com.sonnhuynhh.primewallet.wallet.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sonnhuynhh.primewallet.config.BridgeProperties;
import com.sonnhuynhh.primewallet.config.TokenProperties;
import com.sonnhuynhh.primewallet.wallet.dto.BridgeRatesResponse;
import com.sonnhuynhh.primewallet.wallet.enums.BlockchainNetwork;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Lấy tỷ giá crypto → VND realtime từ CoinGecko (cache ngắn, fallback cấu hình tĩnh).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BridgeRateService {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price";

    /** symbol → CoinGecko id */
    private static final Map<String, String> SYMBOL_TO_COINGECKO_ID = Map.of(
            "ETH", "ethereum",
            "BNB", "binancecoin",
            "POL", "polygon-ecosystem-token",
            "MATIC", "polygon-ecosystem-token",
            "USDC", "usd-coin",
            "USDT", "tether",
            "DAI", "dai"
    );

    private final RestTemplate restTemplate;
    private final BridgeProperties bridgeProperties;
    private final TokenProperties tokenProperties;

    private volatile RateSnapshot cache;

    private record RateSnapshot(
            Map<String, BigDecimal> ratesBySymbol,
            Instant fetchedAt,
            String source
    ) {}

    public BridgeRatesResponse getRatesForNetwork(String networkId) {
        BlockchainNetwork network = BlockchainNetwork.fromIdWithLegacy(networkId);
        refreshIfStale();

        Map<String, BigDecimal> rates = new LinkedHashMap<>();
        for (String symbol : collectSymbols(network)) {
            BigDecimal rate = lookupRate(network, symbol);
            if (rate != null && rate.compareTo(BigDecimal.ZERO) > 0) {
                rates.put(symbol, rate);
            }
        }

        RateSnapshot snap = cache;
        return BridgeRatesResponse.builder()
                .rates(rates)
                .source(snap != null ? snap.source() : "fallback")
                .updatedAt(snap != null ? snap.fetchedAt() : null)
                .build();
    }

    public BigDecimal getRateVnd(BlockchainNetwork network, String tokenSymbol) {
        refreshIfStale();
        String symbol = normalizeSymbol(tokenSymbol, network);
        return lookupRate(network, symbol);
    }

    public String currentSource() {
        RateSnapshot snap = cache;
        return snap != null ? snap.source() : "fallback";
    }

    public Instant currentUpdatedAt() {
        RateSnapshot snap = cache;
        return snap != null ? snap.fetchedAt() : null;
    }

    private BigDecimal lookupRate(BlockchainNetwork network, String symbol) {
        RateSnapshot snap = cache;
        if (snap != null) {
            BigDecimal live = snap.ratesBySymbol().get(symbol);
            if (live != null && live.compareTo(BigDecimal.ZERO) > 0) {
                return applySpread(live);
            }
        }
        return fallbackRate(network.getId(), symbol);
    }

    private void refreshIfStale() {
        RateSnapshot snap = cache;
        int ttl = Math.max(15, bridgeProperties.getRateCacheSeconds());
        if (snap != null && snap.fetchedAt().plusSeconds(ttl).isAfter(Instant.now())) {
            return;
        }

        synchronized (this) {
            snap = cache;
            if (snap != null && snap.fetchedAt().plusSeconds(ttl).isAfter(Instant.now())) {
                return;
            }
            try {
                cache = fetchFromCoinGecko();
                log.debug("CoinGecko rates refreshed: {} symbols", cache.ratesBySymbol().size());
            } catch (Exception ex) {
                log.warn("Không lấy được tỷ giá CoinGecko: {}", ex.getMessage());
                if (snap == null) {
                    cache = new RateSnapshot(Map.of(), Instant.now(), "fallback");
                }
            }
        }
    }

    private RateSnapshot fetchFromCoinGecko() throws Exception {
        String ids = SYMBOL_TO_COINGECKO_ID.values().stream()
                .collect(Collectors.toCollection(LinkedHashSet::new))
                .stream()
                .collect(Collectors.joining(","));

        String url = COINGECKO_URL
                + "?ids=" + ids
                + "&vs_currencies=vnd"
                + "&include_last_updated_at=true";

        HttpHeaders headers = new HttpHeaders();
        String apiKey = bridgeProperties.getCoingeckoApiKey();
        if (apiKey != null && !apiKey.isBlank()) {
            headers.set("x-cg-demo-api-key", apiKey.trim());
        }

        ResponseEntity<String> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class
        );

        JsonNode root = JSON.readTree(response.getBody());
        Map<String, BigDecimal> bySymbol = new HashMap<>();
        Instant latest = Instant.EPOCH;

        for (Map.Entry<String, String> entry : SYMBOL_TO_COINGECKO_ID.entrySet()) {
            JsonNode node = root.get(entry.getValue());
            if (node == null || !node.has("vnd")) {
                continue;
            }
            bySymbol.put(entry.getKey(), node.get("vnd").decimalValue());
            if (node.has("last_updated_at")) {
                Instant ts = Instant.ofEpochSecond(node.get("last_updated_at").asLong());
                if (ts.isAfter(latest)) {
                    latest = ts;
                }
            }
        }

        if (bySymbol.isEmpty()) {
            throw new IllegalStateException("CoinGecko trả về rỗng");
        }

        return new RateSnapshot(
                bySymbol,
                latest.equals(Instant.EPOCH) ? Instant.now() : latest,
                "coingecko"
        );
    }

    private BigDecimal fallbackRate(String networkId, String symbol) {
        Map<String, BigDecimal> networkRates = bridgeProperties.getRates().get(networkId);
        if (networkRates == null) {
            return null;
        }
        BigDecimal rate = networkRates.get(symbol);
        return rate != null ? applySpread(rate) : null;
    }

    private BigDecimal applySpread(BigDecimal rate) {
        int bps = bridgeProperties.getSpreadBps();
        if (bps <= 0) {
            return rate.setScale(2, RoundingMode.DOWN);
        }
        BigDecimal factor = BigDecimal.ONE.subtract(
                BigDecimal.valueOf(bps).divide(BigDecimal.valueOf(10_000), 8, RoundingMode.HALF_UP)
        );
        return rate.multiply(factor).setScale(2, RoundingMode.DOWN);
    }

    private List<String> collectSymbols(BlockchainNetwork network) {
        Set<String> symbols = new LinkedHashSet<>();
        symbols.add(network.getNativeSymbol().toUpperCase(Locale.ROOT));

        List<TokenProperties.TokenConfig> tokens = tokenProperties.getTokens().get(network.getId());
        if (tokens != null) {
            for (TokenProperties.TokenConfig token : tokens) {
                symbols.add(token.getSymbol().toUpperCase(Locale.ROOT));
            }
        }
        return new ArrayList<>(symbols);
    }

    private static String normalizeSymbol(String tokenSymbol, BlockchainNetwork network) {
        String symbol = tokenSymbol.toUpperCase(Locale.ROOT);
        if ("WETH".equals(symbol)) {
            return "ETH";
        }
        if ("WBNB".equals(symbol)) {
            return "BNB";
        }
        if ("WMATIC".equals(symbol)) {
            return "POL";
        }
        String nativeSymbol = network.getNativeSymbol().toUpperCase(Locale.ROOT);
        if (symbol.equals(nativeSymbol)) {
            return nativeSymbol;
        }
        return symbol;
    }
}
