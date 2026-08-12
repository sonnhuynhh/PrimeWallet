package com.sonnhuynhh.primewallet.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sonnhuynhh.primewallet.wallet.entity.Account;
import com.sonnhuynhh.primewallet.wallet.entity.Transaction;
import com.sonnhuynhh.primewallet.wallet.event.TransactionEvent;
import com.sonnhuynhh.primewallet.wallet.repository.AccountRepository;
import com.sonnhuynhh.primewallet.wallet.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Client gọi AI microservice (FastAPI, port 8000).
 *
 * Kiến trúc:
 * - Giao dịch fiat phát qua Kafka → AI lưu SQLite + train model
 * - Nếu AI khởi động muộn → {@link #ensureUserSynced(UUID)} đẩy lịch sử từ Postgres
 * - UI đọc insights/risk-score qua endpoint proxy này
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AiInsightService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${ai.service.base-url:http://localhost:8000}")
    private String aiBaseUrl;

    public Map<String, Object> getInsights(String userId) {
        ensureUserSynced(UUID.fromString(userId));
        return getJson("/api/ai/users/" + userId + "/insights");
    }

    public Map<String, Object> getRiskScore(String userId) {
        ensureUserSynced(UUID.fromString(userId));
        return getJson("/api/ai/users/" + userId + "/risk-score");
    }

    /**
     * Báo cáo gian lận toàn hệ thống (Admin).
     * AI trả danh sách user_id + risk; caller có thể enrich thêm email/tên.
     */
    public Map<String, Object> getFraudReport(String minLevel, int limit) {
        String level = (minLevel == null || minLevel.isBlank()) ? "SAFE" : minLevel.trim().toUpperCase();
        int capped = Math.max(1, Math.min(limit, 500));
        return getJson("/api/ai/fraud-report?min_level=" + level + "&limit=" + capped);
    }

    public boolean isAvailable() {
        Map<String, Object> health = getJson("/api/ai/health");
        return Boolean.TRUE.equals(health.get("available")) && "ok".equals(health.get("status"));
    }

    /**
     * Đồng bộ lịch sử fiat sang AI nếu user chưa có dữ liệu (Kafka miss / AI restart).
     */
    public void ensureUserSynced(UUID userId) {
        if (!isAvailable()) {
            return;
        }
        try {
            int existing = getUserAiCount(userId);
            if (existing > 0) {
                return;
            }
            syncUserTransactions(userId);
        } catch (Exception e) {
            log.warn("AI sync thất bại cho user {}: {}", userId, e.getMessage());
        }
    }

    private int getUserAiCount(UUID userId) {
        Map<String, Object> body = getJson("/api/ai/users/" + userId + "/count");
        Object count = body.get("count");
        if (count instanceof Number number) {
            return number.intValue();
        }
        return 0;
    }

    private void syncUserTransactions(UUID userId) {
        List<Account> accounts = accountRepository.findByUserId(userId);
        Map<UUID, TransactionEvent> events = new LinkedHashMap<>();

        for (Account account : accounts) {
            Page<Transaction> page = transactionRepository.findByAccountId(
                    account.getId(), PageRequest.of(0, 200));
            for (Transaction transaction : page.getContent()) {
                events.putIfAbsent(transaction.getId(), toEvent(transaction, userId));
            }
        }

        if (events.isEmpty()) {
            return;
        }

        postJson("/api/ai/users/" + userId + "/ingest", Map.of("events", new ArrayList<>(events.values())));
        log.info("Đã đồng bộ {} giao dịch fiat sang AI cho user {}", events.size(), userId);
    }

    private TransactionEvent toEvent(Transaction transaction, UUID userId) {
        return TransactionEvent.builder()
                .transactionId(transaction.getId())
                .userId(userId)
                .referenceNumber(transaction.getReferenceNumber())
                .transactionType(transaction.getTransactionType().name())
                .sourceAccountNumber(
                        transaction.getSourceAccount() != null
                                ? transaction.getSourceAccount().getAccountNumber()
                                : null)
                .destinationAccountNumber(
                        transaction.getDestinationAccount() != null
                                ? transaction.getDestinationAccount().getAccountNumber()
                                : null)
                .amount(transaction.getAmount())
                .currency(transaction.getCurrency())
                .status(transaction.getStatus().name())
                .description(transaction.getDescription())
                .timestamp(transaction.getCreatedAt() != null
                        ? transaction.getCreatedAt().toString()
                        : LocalDateTime.now().toString())
                .build();
    }

    private Map<String, Object> getJson(String path) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(aiBaseUrl + path))
                    .timeout(Duration.ofSeconds(8))
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return parseBody(response.statusCode(), response.body());
        } catch (Exception e) {
            log.warn("Không gọi được AI service ({}) — {}", aiBaseUrl, e.getMessage());
            return unavailable("AI service không khả dụng — hãy khởi động " + aiBaseUrl, e.getMessage());
        }
    }

    private void postJson(String path, Object payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(aiBaseUrl + path))
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("AI ingest trả về {}: {}", response.statusCode(), response.body());
            }
        } catch (Exception e) {
            log.warn("AI ingest thất bại: {}", e.getMessage());
        }
    }

    private Map<String, Object> parseBody(int statusCode, String body) {
        if (statusCode != 200) {
            log.warn("AI service trả về status {}", statusCode);
            return unavailable("AI service trả về " + statusCode, null);
        }
        try {
            JsonNode node = objectMapper.readTree(body);
            if (node.isObject()) {
                Map<String, Object> map = objectMapper.convertValue(node, Map.class);
                map.put("available", true);
                return map;
            }
            return Map.of("available", true, "data", node.toString());
        } catch (Exception e) {
            return unavailable("Phản hồi AI không hợp lệ", e.getMessage());
        }
    }

    private Map<String, Object> unavailable(String error, String detail) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("available", false);
        map.put("error", error);
        if (detail != null) {
            map.put("message", detail);
        }
        return map;
    }
}
