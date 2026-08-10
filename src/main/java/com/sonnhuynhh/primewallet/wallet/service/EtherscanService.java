package com.sonnhuynhh.primewallet.wallet.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sonnhuynhh.primewallet.wallet.dto.EtherscanResponse;
import com.sonnhuynhh.primewallet.wallet.enums.BlockchainNetwork;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Service gọi explorer API V2 — mỗi mạng dùng đúng domain (BscScan, PolygonScan…).
 * Gói miễn phí Etherscan không hỗ trợ BSC/Polygon/Base qua api.etherscan.io/v2.
 *
 * @see <a href="https://docs.etherscan.io/v2-migration">Etherscan V2 migration</a>
 */
@Service
@Slf4j
public class EtherscanService {

    private static final ObjectMapper JSON = new ObjectMapper();

    /** Endpoint V2 theo explorer — không dùng V1 (đã deprecated). */
    private static final Map<BlockchainNetwork, String> V2_API = Map.of(
            BlockchainNetwork.ETHEREUM_MAINNET, "https://api.etherscan.io/v2/api",
            BlockchainNetwork.ETH_SEPOLIA, "https://api.etherscan.io/v2/api",
            BlockchainNetwork.BSC_MAINNET, "https://api.bscscan.com/v2/api",
            BlockchainNetwork.POLYGON_MAINNET, "https://api.polygonscan.com/v2/api",
            BlockchainNetwork.BASE_MAINNET, "https://api.basescan.org/v2/api"
    );

    private final RestTemplate restTemplate;
    private final String apiKey;

    public EtherscanService(
            RestTemplate restTemplate,
            @Value("${etherscan.api-key:}") String apiKey) {
        this.restTemplate = restTemplate;
        this.apiKey = apiKey;
    }

    public EtherscanResponse getTransactionHistory(String address, BlockchainNetwork network) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("etherscan.api-key chưa cấu hình — tra cứu on-chain sẽ thất bại");
            return emptyResponse("0", "Chưa cấu hình ETHERSCAN_API_KEY trên backend");
        }

        if (!isValidAddress(address)) {
            return emptyResponse("0", "Địa chỉ ví không hợp lệ (phải bắt đầu 0x và đủ 40 ký tự hex)");
        }

        Map<String, String> txParams = Map.of(
                "module", "account",
                "action", "txlist",
                "address", address,
                "startblock", "0",
                "endblock", "99999999",
                "page", "1",
                "offset", "100",
                "sort", "desc"
        );

        String v2Base = V2_API.getOrDefault(network, V2_API.get(BlockchainNetwork.ETH_SEPOLIA));
        EtherscanResponse response = parseTxListResponse(buildV2Url(v2Base, network, txParams), address, network);

        // Fallback: thử unified etherscan.io V2 nếu explorer riêng thất bại (một số gói trả paid-only)
        if (!isSuccessfulTxList(response) && !v2Base.contains("api.etherscan.io")) {
            log.info("Explorer V2 {} thất bại, thử api.etherscan.io/v2 cho {}", v2Base, network.getId());
            response = parseTxListResponse(
                    buildV2Url("https://api.etherscan.io/v2/api", network, txParams),
                    address, network);
        }

        return response;
    }

    public EtherscanResponse getTransactionHistory(String address) {
        return getTransactionHistory(address, BlockchainNetwork.ETH_SEPOLIA);
    }

    public BigInteger getWalletBalance(String address, BlockchainNetwork network) {
        if (apiKey == null || apiKey.isBlank() || !isValidAddress(address)) {
            return null;
        }

        String v2Base = V2_API.getOrDefault(network, V2_API.get(BlockchainNetwork.ETH_SEPOLIA));
        String url = buildV2Url(v2Base, network, Map.of(
                "module", "account",
                "action", "balance",
                "address", address,
                "tag", "latest"
        ));

        try {
            Map<?, ?> response = restTemplate.getForObject(url, Map.class);
            if (response != null && "1".equals(String.valueOf(response.get("status")))) {
                return new BigInteger(response.get("result").toString());
            }
        } catch (Exception e) {
            log.warn("Explorer V2 get balance failed for {}: {}", network.getId(), e.getMessage());
        }
        return null;
    }

    public BigInteger getWalletBalance(String address) {
        return getWalletBalance(address, BlockchainNetwork.ETH_SEPOLIA);
    }

    private EtherscanResponse parseTxListResponse(String url, String address, BlockchainNetwork network) {
        try {
            String raw = restTemplate.getForObject(url, String.class);
            if (raw == null || raw.isBlank()) {
                return emptyResponse("0", "Empty response from explorer");
            }

            JsonNode root = JSON.readTree(raw);
            String rootStatus = root.path("status").asText("0");
            String rootMessage = root.path("message").asText("");
            JsonNode resultNode = root.get("result");

            if (resultNode != null && !resultNode.isNull() && resultNode.isTextual()) {
                String detail = resultNode.asText("");
                if (isNoTransactionsMessage(detail) || isNoTransactionsMessage(rootMessage)) {
                    return successResponse(Collections.emptyList());
                }
                log.warn("Explorer txlist lỗi cho {} on {}: {} / {}", address, network.getId(), rootMessage, detail);
                return emptyResponse("0", formatExplorerMessage(rootMessage, detail));
            }

            if (resultNode == null || resultNode.isNull()) {
                if ("1".equals(rootStatus) || isNoTransactionsMessage(rootMessage)) {
                    return successResponse(Collections.emptyList());
                }
                return emptyResponse("0", formatExplorerMessage(rootMessage, null));
            }

            if (resultNode.isArray()) {
                List<EtherscanResponse.TransactionRecord> records = new ArrayList<>();
                for (JsonNode item : resultNode) {
                    records.add(JSON.treeToValue(item, EtherscanResponse.TransactionRecord.class));
                }
                return successResponse(records);
            }

            return emptyResponse("0", formatExplorerMessage(rootMessage, resultNode.asText("")));
        } catch (Exception e) {
            log.error("Không lấy được lịch sử giao dịch cho {} on {}: {}", address, network.getId(), e.getMessage());
            return emptyResponse("0", "API call failed: " + e.getMessage());
        }
    }

    private EtherscanResponse successResponse(List<EtherscanResponse.TransactionRecord> records) {
        EtherscanResponse response = new EtherscanResponse();
        response.setStatus("1");
        response.setMessage("OK");
        response.setResult(records);
        return response;
    }

    private boolean isSuccessfulTxList(EtherscanResponse response) {
        return "1".equals(response.getStatus());
    }

    private String buildV2Url(String baseUrl, BlockchainNetwork network, Map<String, String> params) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(baseUrl)
                .queryParam("chainid", network.getChainId());
        params.forEach(builder::queryParam);
        return builder.queryParam("apikey", apiKey).build().encode().toUriString();
    }

    private boolean isValidAddress(String address) {
        return address != null && address.matches("0x[0-9a-fA-F]{40}");
    }

    private EtherscanResponse emptyResponse(String status, String message) {
        EtherscanResponse empty = new EtherscanResponse();
        empty.setStatus(status);
        empty.setMessage(message);
        empty.setResult(Collections.emptyList());
        return empty;
    }

    private boolean isNoTransactionsMessage(String msg) {
        if (msg == null || msg.isBlank()) {
            return false;
        }
        String lower = msg.toLowerCase();
        return lower.contains("no transactions")
                || lower.contains("no record found")
                || lower.contains("no tx found");
    }

    private String formatExplorerMessage(String message, String detail) {
        String raw = (detail != null && !detail.isBlank()) ? detail : message;
        if (raw == null || raw.isBlank() || "NOTOK".equalsIgnoreCase(raw)) {
            return "Explorer từ chối yêu cầu — kiểm tra API key hoặc thử lại sau";
        }
        String lower = raw.toLowerCase();
        if (lower.contains("invalid address")) {
            return "Địa chỉ ví không hợp lệ";
        }
        if (lower.contains("invalid api key") || lower.contains("missing/invalid api key")) {
            return "API key Etherscan không hợp lệ — kiểm tra etherscan.api-key";
        }
        if (lower.contains("rate limit") || lower.contains("max rate")) {
            return "Vượt giới hạn gọi API — thử lại sau vài giây";
        }
        if (lower.contains("not supported for this chain")) {
            return "Gói API miễn phí chưa hỗ trợ mạng này qua api.etherscan.io — dùng endpoint BscScan/PolygonScan V2";
        }
        if (lower.contains("deprecated")) {
            return "API V1 đã ngừng — cần restart backend để dùng V2";
        }
        return raw;
    }
}
