package com.sonnhuynhh.primewallet.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/**
 * Client gọi AI microservice (FastAPI, port 8000).
 *
 * Kiến trúc:
 * - Java backend không gọi AI trực tiếp trong luồng giao dịch (chậm)
 * - AI nhận event qua Kafka ("wallet.transactions")
 * - Endpoint này CHỈ dùng để UI hiển thị insights/risk-score từ AI
 *
 * Graceful degradation: nếu AI service offline → trả về trạng thái "unavailable"
 * thay vì làm lỗi API chính (user không thấy insights, không bị chặn giao dịch).
 */
@Service
@Slf4j
public class AiInsightService {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Value("${ai.service.base-url:http://localhost:8000}")
    private String aiBaseUrl;

    public AiInsightService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Lấy insights chi tiêu của user từ AI service.
     */
    public Map<String, Object> getInsights(String userId) {
        return getJson("/api/ai/users/" + userId + "/insights");
    }

    /**
     * Lấy điểm rủi ro gian lận của user từ AI service.
     */
    public Map<String, Object> getRiskScore(String userId) {
        return getJson("/api/ai/users/" + userId + "/risk-score");
    }

    /**
     * Kiểm tra AI service còn sống không.
     */
    public boolean isAvailable() {
        try {
            Map<String, Object> health = getJson("/api/ai/health");
            return "ok".equals(health.get("status"));
        } catch (Exception e) {
            return false;
        }
    }

    private Map<String, Object> getJson(String path) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(aiBaseUrl + path))
                    .timeout(Duration.ofSeconds(5))
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.warn("AI service trả về status {} cho {}", response.statusCode(), path);
                return Map.of("available", false, "error", "AI service trả về " + response.statusCode());
            }

            JsonNode node = objectMapper.readTree(response.body());
            if (node.isObject()) {
                Map<String, Object> map = objectMapper.convertValue(node, Map.class);
                map.put("available", true);
                return map;
            }
            return Map.of("available", true, "data", node.toString());
        } catch (Exception e) {
            log.warn("Không gọi được AI service ({}) — {}", aiBaseUrl, e.getMessage());
            return Map.of(
                    "available", false,
                    "error", "AI service không khả dụng — hãy khởi động " + aiBaseUrl,
                    "message", e.getMessage()
            );
        }
    }
}
