package com.sonnhuynhh.primewallet.wallet.service;

import com.sonnhuynhh.primewallet.wallet.dto.EtherscanResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
@RequiredArgsConstructor
public class EtherscanService {

    @Value("${etherscan.api-key}")
    private String apiKey;

    private final RestTemplate restTemplate;

    // We use Sepolia Etherscan API
    private static final String API_URL = "https://api-sepolia.etherscan.io/api";

    public EtherscanResponse getTransactionHistory(String address) {
        String url = String.format("%s?module=account&action=txlist&address=%s&startblock=0&endblock=99999999&page=1&offset=100&sort=desc&apikey=%s",
                API_URL, address, apiKey);

        return restTemplate.getForObject(url, EtherscanResponse.class);
    }

    public java.math.BigInteger getWalletBalance(String address) {
        String url = String.format("%s?module=account&action=balance&address=%s&tag=latest&apikey=%s",
                API_URL, address, apiKey);

        try {
            java.util.Map response = restTemplate.getForObject(url, java.util.Map.class);
            if (response != null && "1".equals(response.get("status"))) {
                return new java.math.BigInteger(response.get("result").toString());
            }
        } catch (Exception e) {
            System.err.println("Etherscan API get balance failed: " + e.getMessage());
        }
        return null; // Return null if failed
    }
}
