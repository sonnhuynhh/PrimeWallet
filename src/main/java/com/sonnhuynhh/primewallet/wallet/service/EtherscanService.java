package com.sonnhuynhh.primewallet.wallet.service;

import com.sonnhuynhh.primewallet.config.BlockchainProperties;
import com.sonnhuynhh.primewallet.wallet.dto.EtherscanResponse;
import com.sonnhuynhh.primewallet.wallet.enums.BlockchainNetwork;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigInteger;
import java.util.Map;

/**
 * Service gọi Etherscan (hoặc explorer API tương thích: BscScan, PolygonScan)
 * để lấy lịch sử giao dịch và số dư native coin trên các mạng EVM.
 *
 * Mỗi mạng có API URL riêng được cấu hình trong blockchain.networks.*.
 * API key dùng chung một key Etherscan (nếu dùng nhiều explorer nên đăng ký key riêng).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EtherscanService {

    @Value("${etherscan.api-key}")
    private String apiKey;

    private final RestTemplate restTemplate;
    private final BlockchainProperties blockchainProperties;

    /**
     * Lấy lịch sử giao dịch on-chain (txlist) của một địa chỉ trên mạng chỉ định.
     */
    public EtherscanResponse getTransactionHistory(String address, BlockchainNetwork network) {
        String baseUrl = getApiBaseUrl(network);
        String url = String.format("%s?module=account&action=txlist&address=%s&startblock=0&endblock=99999999&page=1&offset=100&sort=desc&apikey=%s",
                baseUrl, address, apiKey);

        try {
            return restTemplate.getForObject(url, EtherscanResponse.class);
        } catch (Exception e) {
            log.error("Không lấy được lịch sử giao dịch từ {} cho {}: {}", baseUrl, address, e.getMessage());
            EtherscanResponse empty = new EtherscanResponse();
            empty.setStatus("0");
            empty.setMessage("API call failed: " + e.getMessage());
            return empty;
        }
    }

    /**
     * Giữ phương thức cũ (mặc định Sepolia) để tương thích với admin controller.
     */
    public EtherscanResponse getTransactionHistory(String address) {
        return getTransactionHistory(address, BlockchainNetwork.ETH_SEPOLIA);
    }

    /**
     * Lấy balance native coin (ETH/BNB/POL) từ explorer API.
     */
    public BigInteger getWalletBalance(String address, BlockchainNetwork network) {
        String baseUrl = getApiBaseUrl(network);
        String url = String.format("%s?module=account&action=balance&address=%s&tag=latest&apikey=%s",
                baseUrl, address, apiKey);

        try {
            Map response = restTemplate.getForObject(url, Map.class);
            if (response != null && "1".equals(response.get("status"))) {
                return new BigInteger(response.get("result").toString());
            }
        } catch (Exception e) {
            log.warn("Etherscan API get balance failed for {}: {}", network.getId(), e.getMessage());
        }
        return null;
    }

    /**
     * Giữ phương thức cũ (mặc định Sepolia) cho tương thích ngược.
     */
    public BigInteger getWalletBalance(String address) {
        return getWalletBalance(address, BlockchainNetwork.ETH_SEPOLIA);
    }

    /**
     * Lấy base URL của explorer API cho mạng (có fallback cấu hình hoặc mặc định theo mạng).
     */
    private String getApiBaseUrl(BlockchainNetwork network) {
        BlockchainProperties.NetworkConfig config = blockchainProperties.getNetworks().get(network.getId());
        if (config != null && config.getEtherscanApiUrl() != null && !config.getEtherscanApiUrl().isBlank()) {
            return config.getEtherscanApiUrl();
        }
        // Fallback mặc định khi chưa cấu hình
        return switch (network) {
            case ETHEREUM_MAINNET -> "https://api.etherscan.io/api";
            case BSC_TESTNET -> "https://api-testnet.bscscan.com/api";
            case POLYGON_AMOY -> "https://api-amoy.polygonscan.com/api";
            case BASE_SEPOLIA -> "https://api-sepolia.basescan.org/api";
            default -> "https://api-sepolia.etherscan.io/api";
        };
    }
}