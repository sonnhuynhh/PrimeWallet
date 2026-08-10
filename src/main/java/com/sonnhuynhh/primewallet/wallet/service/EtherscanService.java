package com.sonnhuynhh.primewallet.wallet.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sonnhuynhh.primewallet.config.BlockchainProperties;
import com.sonnhuynhh.primewallet.wallet.dto.EtherscanResponse;
import com.sonnhuynhh.primewallet.wallet.enums.BlockchainNetwork;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Service gọi Etherscan (hoặc explorer API tương thích: BscScan, PolygonScan)
 * để lấy lịch sử giao dịch và số dư native coin trên các mạng EVM.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EtherscanService {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Value("${etherscan.api-key:}")
    private String apiKey;

    private final RestTemplate restTemplate;
    private final BlockchainProperties blockchainProperties;

    /**
     * Lấy lịch sử giao dịch on-chain (txlist) của một địa chỉ trên mạng chỉ định.
     *
     * <p>Etherscan trả {@code result} là mảng khi có dữ liệu, nhưng là chuỗi
     * ("No transactions found", "NOTOK") khi rỗng/lỗi — phải parse thủ công.
     */
    public EtherscanResponse getTransactionHistory(String address, BlockchainNetwork network) {
        String baseUrl = getApiBaseUrl(network);
        String keyParam = (apiKey == null || apiKey.isBlank()) ? "" : apiKey;
        String url = String.format(
                "%s?module=account&action=txlist&address=%s&startblock=0&endblock=99999999&page=1&offset=100&sort=desc&apikey=%s",
                baseUrl, address, keyParam);

        try {
            String raw = restTemplate.getForObject(url, String.class);
            if (raw == null || raw.isBlank()) {
                return emptyResponse("0", "Empty response from explorer");
            }

            JsonNode root = JSON.readTree(raw);
            EtherscanResponse response = new EtherscanResponse();
            response.setStatus(root.path("status").asText("0"));
            response.setMessage(root.path("message").asText(""));

            JsonNode resultNode = root.get("result");
            if (resultNode == null || resultNode.isNull()) {
                response.setResult(Collections.emptyList());
                return response;
            }

            if (!resultNode.isArray()) {
                String msg = resultNode.asText("");
                log.debug("Explorer txlist không trả mảng cho {} on {}: {}", address, network.getId(), msg);
                response.setResult(Collections.emptyList());
                return response;
            }

            List<EtherscanResponse.TransactionRecord> records = new ArrayList<>();
            for (JsonNode item : resultNode) {
                EtherscanResponse.TransactionRecord record = JSON.treeToValue(
                        item, EtherscanResponse.TransactionRecord.class);
                records.add(record);
            }
            response.setResult(records);
            return response;
        } catch (Exception e) {
            log.error("Không lấy được lịch sử giao dịch từ {} cho {}: {}", baseUrl, address, e.getMessage());
            return emptyResponse("0", "API call failed: " + e.getMessage());
        }
    }

    public EtherscanResponse getTransactionHistory(String address) {
        return getTransactionHistory(address, BlockchainNetwork.ETH_SEPOLIA);
    }

    public BigInteger getWalletBalance(String address, BlockchainNetwork network) {
        String baseUrl = getApiBaseUrl(network);
        String keyParam = (apiKey == null || apiKey.isBlank()) ? "" : apiKey;
        String url = String.format("%s?module=account&action=balance&address=%s&tag=latest&apikey=%s",
                baseUrl, address, keyParam);

        try {
            Map<?, ?> response = restTemplate.getForObject(url, Map.class);
            if (response != null && "1".equals(String.valueOf(response.get("status")))) {
                return new BigInteger(response.get("result").toString());
            }
        } catch (Exception e) {
            log.warn("Etherscan API get balance failed for {}: {}", network.getId(), e.getMessage());
        }
        return null;
    }

    public BigInteger getWalletBalance(String address) {
        return getWalletBalance(address, BlockchainNetwork.ETH_SEPOLIA);
    }

    private EtherscanResponse emptyResponse(String status, String message) {
        EtherscanResponse empty = new EtherscanResponse();
        empty.setStatus(status);
        empty.setMessage(message);
        empty.setResult(Collections.emptyList());
        return empty;
    }

    private String getApiBaseUrl(BlockchainNetwork network) {
        BlockchainProperties.NetworkConfig config = blockchainProperties.getNetworks().get(network.getId());
        if (config != null && config.getEtherscanApiUrl() != null && !config.getEtherscanApiUrl().isBlank()) {
            return config.getEtherscanApiUrl();
        }
        return switch (network) {
            case ETHEREUM_MAINNET -> "https://api.etherscan.io/api";
            case BSC_MAINNET -> "https://api.bscscan.com/api";
            case POLYGON_MAINNET -> "https://api.polygonscan.com/api";
            case BASE_MAINNET -> "https://api.basescan.org/api";
            default -> "https://api-sepolia.etherscan.io/api";
        };
    }
}
