package com.sonnhuynhh.primewallet.wallet.controller;

import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.common.dto.ApiResponse;
import com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException;
import com.sonnhuynhh.primewallet.wallet.dto.*;
import com.sonnhuynhh.primewallet.wallet.service.BridgeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Bridge Crypto → Fiat: bán token on-chain, nhận VND trên ví Fiat.
 *
 * Base URL: /api/v1/bridge
 */
@RestController
@RequestMapping("/api/v1/bridge")
@RequiredArgsConstructor
public class BridgeController {

    private final BridgeService bridgeService;
    private final UserRepository userRepository;

    /** Tỷ giá realtime theo mạng (symbol → VND / 1 token). */
    @GetMapping("/rates")
    public ResponseEntity<ApiResponse<BridgeRatesResponse>> getRates(
            @RequestParam String network
    ) {
        return ResponseEntity.ok(ApiResponse.success("Tỷ giá bridge", bridgeService.getRatesForNetwork(network)));
    }

    /** Tạo báo giá + lệnh đổi (PENDING_DEPOSIT). */
    @PostMapping("/quote")
    public ResponseEntity<ApiResponse<BridgeQuoteResponse>> quote(
            @Valid @RequestBody BridgeQuoteRequest request,
            Authentication authentication
    ) {
        UUID userId = resolveUserId(authentication);
        BridgeQuoteResponse response = bridgeService.createQuote(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tạo báo giá thành công", response));
    }

    /** Xác minh tx on-chain và cộng VND. */
    @PostMapping("/orders/{orderId}/confirm")
    public ResponseEntity<ApiResponse<BridgeOrderResponse>> confirm(
            @PathVariable UUID orderId,
            @Valid @RequestBody BridgeConfirmRequest request,
            Authentication authentication
    ) {
        UUID userId = resolveUserId(authentication);
        BridgeOrderResponse response = bridgeService.confirmOrder(orderId, request, userId);
        return ResponseEntity.ok(ApiResponse.success("Đổi sang VND thành công", response));
    }

    /** Lịch sử lệnh đổi của user. */
    @GetMapping("/orders")
    public ResponseEntity<ApiResponse<Page<BridgeOrderResponse>>> listOrders(
            Authentication authentication,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        UUID userId = resolveUserId(authentication);
        return ResponseEntity.ok(ApiResponse.success("Lịch sử lệnh đổi", bridgeService.listOrders(userId, pageable)));
    }

    private UUID resolveUserId(Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));
        return user.getId();
    }
}
