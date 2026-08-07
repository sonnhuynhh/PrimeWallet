package com.sonnhuynhh.primewallet.ai.controller;

import com.sonnhuynhh.primewallet.ai.service.AiInsightService;
import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.common.dto.ApiResponse;
import com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * Controller hiển thị kết quả AI (insights chi tiêu + risk score) cho user.
 *
 * Base URL: /api/v1/ai
 *
 * Quan trọng: đây CHỈ là "màn hình hiển thị" dữ liệu AI đã tính sẵn.
 * AI service nhận dữ liệu giao dịch qua Kafka (wallet.transactions),
 * không phải qua API gọi ngược ở đây → không làm chậm giao dịch.
 */
@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiInsightController {

    private final AiInsightService aiInsightService;
    private final UserRepository userRepository;

    private UUID getUserId(Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return user.getId();
    }

    /**
     * Insights chi tiêu (tiếng Việt) của user đang đăng nhập.
     */
    @GetMapping("/insights")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMyInsights(Authentication authentication) {
        UUID userId = getUserId(authentication);
        return ResponseEntity.ok(ApiResponse.success("Insights chi tiêu",
                aiInsightService.getInsights(userId.toString())));
    }

    /**
     * Điểm rủi ro gian lận của user đang đăng nhập.
     */
    @GetMapping("/risk-score")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMyRiskScore(Authentication authentication) {
        UUID userId = getUserId(authentication);
        return ResponseEntity.ok(ApiResponse.success("Điểm rủi ro",
                aiInsightService.getRiskScore(userId.toString())));
    }

    /**
     * Trạng thái AI service (cho UI hiển thị badge).
     */
    @GetMapping("/health")
    public ResponseEntity<ApiResponse<Map<String, Object>>> aiHealth() {
        return ResponseEntity.ok(ApiResponse.success("Trạng thái AI",
                Map.of("available", aiInsightService.isAvailable())));
    }
}