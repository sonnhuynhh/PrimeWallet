package com.sonnhuynhh.primewallet.wallet.controller;

import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException;
import com.sonnhuynhh.primewallet.common.dto.ApiResponse;
import com.sonnhuynhh.primewallet.wallet.dto.CryptoWalletResponse;
import com.sonnhuynhh.primewallet.wallet.dto.LinkWalletRequest;
import com.sonnhuynhh.primewallet.wallet.service.CryptoWalletService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/crypto/wallets")
@RequiredArgsConstructor
public class CryptoWalletController {

    private final CryptoWalletService cryptoWalletService;
    private final UserRepository userRepository;

    private UUID getUserId(Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return user.getId();
    }

    @PostMapping("/link")
    public ResponseEntity<ApiResponse<CryptoWalletResponse>> linkWallet(
            Authentication authentication,
            @Valid @RequestBody LinkWalletRequest request) {
        
        UUID userId = getUserId(authentication);
        CryptoWalletResponse response = cryptoWalletService.linkWallet(userId, request);
        return ResponseEntity.ok(ApiResponse.success("Liên kết ví thành công", response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<CryptoWalletResponse>>> getLinkedWallets(
            Authentication authentication) {
        
        UUID userId = getUserId(authentication);
        List<CryptoWalletResponse> response = cryptoWalletService.getLinkedWallets(userId);
        return ResponseEntity.ok(ApiResponse.success("Danh sách ví liên kết", response));
    }

    @GetMapping("/{walletId}/balance")
    public ResponseEntity<ApiResponse<com.sonnhuynhh.primewallet.wallet.dto.WalletBalanceResponse>> getWalletBalance(
            Authentication authentication,
            @PathVariable UUID walletId) {
        
        UUID userId = getUserId(authentication);
        com.sonnhuynhh.primewallet.wallet.dto.WalletBalanceResponse response = cryptoWalletService.getWalletBalance(userId, walletId);
        return ResponseEntity.ok(ApiResponse.success("Số dư ví", response));
    }

    @GetMapping("/{walletId}/history")
    public ResponseEntity<ApiResponse<com.sonnhuynhh.primewallet.wallet.dto.EtherscanResponse>> getWalletHistory(
            Authentication authentication,
            @PathVariable UUID walletId,
            @org.springframework.beans.factory.annotation.Autowired com.sonnhuynhh.primewallet.wallet.service.EtherscanService etherscanService) {
        
        // Ensure the wallet belongs to the user
        UUID userId = getUserId(authentication);
        com.sonnhuynhh.primewallet.wallet.dto.WalletBalanceResponse walletInfo = cryptoWalletService.getWalletBalance(userId, walletId);
        
        com.sonnhuynhh.primewallet.wallet.dto.EtherscanResponse response = etherscanService.getTransactionHistory(walletInfo.getWalletAddress());
        return ResponseEntity.ok(ApiResponse.success("Lịch sử giao dịch ví", response));
    }
}
