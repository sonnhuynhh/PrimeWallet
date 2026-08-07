package com.sonnhuynhh.primewallet.wallet.controller;

import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException;
import com.sonnhuynhh.primewallet.common.dto.ApiResponse;
import com.sonnhuynhh.primewallet.config.BlockchainProperties;
import com.sonnhuynhh.primewallet.wallet.dto.*;
import com.sonnhuynhh.primewallet.wallet.entity.CryptoWallet;
import com.sonnhuynhh.primewallet.wallet.enums.BlockchainNetwork;
import com.sonnhuynhh.primewallet.wallet.service.CryptoWalletService;
import com.sonnhuynhh.primewallet.wallet.service.OwnershipVerificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * Controller quản lý ví Crypto (Non-Custodial — chỉ lưu public address).
 *
 * Base URL: /api/v1/crypto/wallets
 *
 * Endpoints:
 * - POST /link                    → Liên kết ví (multi-network, nhiều ví)
 * - GET  /networks                → Danh sách mạng blockchain hỗ trợ
 * - GET  /                        → Danh sách ví đã liên kết
 * - GET  /{walletId}/balance      → Số dư native + token ERC-20
 * - GET  /{walletId}/tokens       → Danh sách token hỗ trợ trên mạng của ví
 * - GET  /{walletId}/history      → Lịch sử on-chain (Etherscan/explorer)
 * - GET  /{walletId}/transactions → Lịch sử giao dịch user thực hiện trong app
 * - DELETE /{walletId}            → Xóa ví đã liên kết
 * - POST /ownership/challenge     → Tạo challenge xác minh quyền sở hữu
 * - POST /ownership/verify        → Xác minh signature
 */
@RestController
@RequestMapping("/api/v1/crypto/wallets")
@RequiredArgsConstructor
public class CryptoWalletController {

    private final CryptoWalletService cryptoWalletService;
    private final OwnershipVerificationService ownershipVerificationService;
    private final BlockchainProperties blockchainProperties;
    private final UserRepository userRepository;

    private UUID getUserId(Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return user.getId();
    }

    // ==================== MẠNG & LINK ====================

    /**
     * Danh sách mạng blockchain được hỗ trợ.
     */
    @GetMapping("/networks")
    public ResponseEntity<ApiResponse<List<NetworkInfoResponse>>> getSupportedNetworks() {
        List<NetworkInfoResponse> networks = Arrays.stream(BlockchainNetwork.values())
                .map(n -> {
                    BlockchainProperties.NetworkConfig config = blockchainProperties.getNetworks().get(n.getId());
                    return NetworkInfoResponse.builder()
                            .id(n.getId())
                            .label(config != null && config.getLabel() != null ? config.getLabel() : n.getLabel())
                            .nativeSymbol(n.getNativeSymbol())
                            .chainId(n.getChainId())
                            .testnet(n.isTestnet())
                            .explorerUrl(config != null ? config.getExplorerUrl() : null)
                            .build();
                })
                .toList();
        return ResponseEntity.ok(ApiResponse.success("Danh sách mạng hỗ trợ", networks));
    }

    /**
     * Liên kết một địa chỉ ví.
     */
    @PostMapping("/link")
    public ResponseEntity<ApiResponse<CryptoWalletResponse>> linkWallet(
            Authentication authentication,
            @Valid @RequestBody LinkWalletRequest request) {

        UUID userId = getUserId(authentication);
        CryptoWalletResponse response = cryptoWalletService.linkWallet(userId, request);
        return ResponseEntity.ok(ApiResponse.success("Liên kết ví thành công", response));
    }

    /**
     * Danh sách ví đã liên kết của user.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<CryptoWalletResponse>>> getLinkedWallets(
            Authentication authentication) {

        UUID userId = getUserId(authentication);
        return ResponseEntity.ok(ApiResponse.success(
                "Danh sách ví liên kết", cryptoWalletService.getLinkedWallets(userId)));
    }

    // ==================== SỐ DƯ & TOKENS ====================

    /**
     * Số dư ví: native coin + token ERC-20.
     */
    @GetMapping("/{walletId}/balance")
    public ResponseEntity<ApiResponse<WalletBalanceResponse>> getWalletBalance(
            Authentication authentication,
            @PathVariable UUID walletId) {

        UUID userId = getUserId(authentication);
        return ResponseEntity.ok(ApiResponse.success("Số dư ví", cryptoWalletService.getWalletBalance(userId, walletId)));
    }

    /**
     * Số dư 1 token ERC-20 cụ thể.
     */
    @GetMapping("/{walletId}/tokens/{contractAddress}/balance")
    public ResponseEntity<ApiResponse<TokenBalanceResponse>> getTokenBalance(
            Authentication authentication,
            @PathVariable UUID walletId,
            @PathVariable String contractAddress) {

        UUID userId = getUserId(authentication);
        return ResponseEntity.ok(ApiResponse.success("Số dư token",
                cryptoWalletService.getTokenBalanceOfWallet(userId, walletId, contractAddress)));
    }

    /**
     * Danh sách token được hỗ trợ trên mạng của ví.
     */
    @GetMapping("/{walletId}/tokens")
    public ResponseEntity<ApiResponse<List<TokenConfigResponse>>> getSupportedTokens(
            Authentication authentication,
            @PathVariable UUID walletId) {

        UUID userId = getUserId(authentication);
        CryptoWallet wallet = cryptoWalletService.findByOwner(userId, walletId);
        BlockchainNetwork network = BlockchainNetwork.fromIdWithLegacy(wallet.getBlockchainNetwork());
        return ResponseEntity.ok(ApiResponse.success("Danh sách token",
                cryptoWalletService.getSupportedTokensForNetwork(network)));
    }

    // ==================== LỊCH SỬ ====================

    /**
     * Lịch sử on-chain từ explorer (Etherscan/BscScan/PolygonScan).
     */
    @GetMapping("/{walletId}/history")
    public ResponseEntity<ApiResponse<EtherscanResponse>> getWalletHistory(
            Authentication authentication,
            @PathVariable UUID walletId) {

        UUID userId = getUserId(authentication);
        return ResponseEntity.ok(ApiResponse.success("Lịch sử giao dịch ví",
                cryptoWalletService.getWalletHistory(userId, walletId)));
    }

    /**
     * Lịch sử giao dịch user thực hiện trong app (phân trang).
     */
    @GetMapping("/{walletId}/transactions")
    public ResponseEntity<ApiResponse<Page<CryptoTransactionResponse>>> getMyCryptoTransactions(
            Authentication authentication,
            @PathVariable UUID walletId,
            Pageable pageable) {

        UUID userId = getUserId(authentication);
        return ResponseEntity.ok(ApiResponse.success("Lịch sử giao dịch của bạn",
                cryptoWalletService.getMyCryptoTransactions(userId, walletId, pageable)));
    }

    // ==================== XÓA VÍ ====================

    /**
     * Xóa ví đã liên kết (không xóa tài sản on-chain).
     */
    @DeleteMapping("/{walletId}")
    public ResponseEntity<ApiResponse<Void>> unlinkWallet(
            Authentication authentication,
            @PathVariable UUID walletId) {

        UUID userId = getUserId(authentication);
        CryptoWallet wallet = cryptoWalletService.findByOwner(userId, walletId);
        cryptoWalletService.deleteWallet(wallet);
        return ResponseEntity.ok(ApiResponse.success("Đã xóa ví khỏi tài khoản"));
    }

    // ==================== OWNERSHIP VERIFICATION ====================

    /**
     * Tạo challenge để xác minh quyền sở hữu ví.
     */
    @PostMapping("/ownership/challenge")
    public ResponseEntity<ApiResponse<OwnershipChallengeResponse>> createOwnershipChallenge(
            @RequestParam String address) {

        OwnershipChallengeResponse challenge = ownershipVerificationService.createChallenge(address);
        return ResponseEntity.ok(ApiResponse.success("Challenge tạo thành công — ký message bằng private key của bạn", challenge));
    }

    /**
     * Xác minh signature do user ký bằng private key.
     * Nếu đúng → address khớp → xác nhận quyền sở hữu.
     */
    @PostMapping("/ownership/verify")
    public ResponseEntity<ApiResponse<OwnershipVerificationResult>> verifyOwnership(
            @Valid @RequestBody VerifyOwnershipRequest request) {

        boolean challengeValid = ownershipVerificationService.isValidChallenge(request.getAddress(), request.getMessage());
        if (!challengeValid) {
            return ResponseEntity.ok(ApiResponse.error("Challenge không hợp lệ hoặc đã hết hạn — hãy tạo challenge mới"));
        }

        boolean verified = ownershipVerificationService.verifySignature(
                request.getAddress(), request.getMessage(), request.getSignature());

        if (verified) {
            ownershipVerificationService.invalidateChallenge(request.getAddress());
        }

        return ResponseEntity.ok(ApiResponse.success(
                verified ? "Xác minh thành công — bạn là chủ sở hữu ví" : "Chữ ký không khớp với địa chỉ ví",
                OwnershipVerificationResult.builder().verified(verified).build()));
    }
}