package com.sonnhuynhh.primewallet.wallet.controller;

import com.sonnhuynhh.primewallet.wallet.dto.BroadcastTransactionRequest;
import com.sonnhuynhh.primewallet.wallet.dto.TransactionHashResponse;
import com.sonnhuynhh.primewallet.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.methods.response.EthGasPrice;
import com.sonnhuynhh.primewallet.common.service.AuditService;
import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException;
import org.springframework.security.core.Authentication;
import org.web3j.protocol.core.methods.response.EthSendTransaction;

import java.math.BigInteger;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/crypto/transactions")
@RequiredArgsConstructor
public class CryptoTransactionController {

    private final Web3j web3j;
    private final AuditService auditService;
    private final UserRepository userRepository;

    private UUID getUserId(Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return user.getId();
    }

    @GetMapping("/gas-price")
    public ResponseEntity<ApiResponse<BigInteger>> getGasPrice() {
        try {
            EthGasPrice gasPrice = web3j.ethGasPrice().send();
            return ResponseEntity.ok(ApiResponse.success("Phí Gas hiện tại", gasPrice.getGasPrice()));
        } catch (Exception e) {
            throw new RuntimeException("Failed to fetch gas price", e);
        }
    }

    @PostMapping("/broadcast")
    public ResponseEntity<ApiResponse<TransactionHashResponse>> broadcastTransaction(
            Authentication authentication,
            @RequestBody BroadcastTransactionRequest request) {
        try {
            EthSendTransaction ethSendTransaction = web3j.ethSendRawTransaction(request.getSignedTransactionHex()).send();
            if (ethSendTransaction.hasError()) {
                throw new RuntimeException("Error broadcasting transaction: " + ethSendTransaction.getError().getMessage());
            }
            
            UUID userId = getUserId(authentication);
            auditService.log(userId, "BROADCAST_CRYPTO_TX", "Đẩy giao dịch Crypto lên mạng (Hash: " + ethSendTransaction.getTransactionHash() + ")", null);

            return ResponseEntity.ok(ApiResponse.success("Đẩy giao dịch lên mạng thành công", new TransactionHashResponse(ethSendTransaction.getTransactionHash())));
        } catch (Exception e) {
            throw new RuntimeException("Failed to broadcast transaction", e);
        }
    }
}
