package com.sonnhuynhh.primewallet.config;

import com.sonnhuynhh.primewallet.wallet.enums.BlockchainNetwork;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Provider quản lý các kết nối Web3j theo mạng blockchain (Multi-network support).
 *
 * Mỗi mạng ({@link BlockchainNetwork}) có một instance Web3j riêng
 * kết nối tới RPC endpoint tương ứng, được lấy lười (lazy) và cache lại.
 * Tránh việc tạo kết nối mới mỗi lần gọi — tiết kiệm tài nguyên.
 */
@Component
@Slf4j
public class Web3jProvider {

    private final BlockchainProperties blockchainProperties;
    private final Map<String, Web3j> cache = new ConcurrentHashMap<>();

    public Web3jProvider(BlockchainProperties blockchainProperties) {
        this.blockchainProperties = blockchainProperties;
    }

    /**
     * Lấy Web3j instance cho một mạng cụ thể.
     * Nếu mạng chưa được cấu hình RPC trong properties → fallback về Web3j mặc định (đã tạo ở Web3Config).
     */
    public Web3j getWeb3j(BlockchainNetwork network) {
        return cache.computeIfAbsent(network.getId(), key -> {
            BlockchainProperties.NetworkConfig config = blockchainProperties.getNetworks().get(network.getId());
            if (config != null && config.getRpcUrl() != null && !config.getRpcUrl().isBlank()) {
                log.info("Khởi tạo Web3j cho mạng {} → {}", network.getId(), config.getRpcUrl());
                return Web3j.build(new HttpService(config.getRpcUrl()));
            }
            log.warn("Không có RPC URL cho mạng {}, dùng URL mặc định {}", network.getId(), "web3.rpc-url");
            // Fallback: dùng bean Web3j mặc định (Sepolia) được tạo ở Web3Config
            throw new IllegalStateException("Chưa cấu hình RPC URL cho mạng: " + network.getId());
        });
    }

    /**
     * Lấy RPC URL đã cấu hình cho mạng (dùng cho frontend hiển thị / ký client-side).
     */
    public String getRpcUrl(BlockchainNetwork network) {
        BlockchainProperties.NetworkConfig config = blockchainProperties.getNetworks().get(network.getId());
        return config != null ? config.getRpcUrl() : null;
    }

    /**
     * Lấy Chain ID đã cấu hình (dùng verify chống replay attack khi broadcast).
     */
    public Long getChainId(BlockchainNetwork network) {
        BlockchainProperties.NetworkConfig config = blockchainProperties.getNetworks().get(network.getId());
        return config != null ? config.getChainId() : network.getChainId();
    }
}