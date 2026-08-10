package com.sonnhuynhh.primewallet.wallet.controller;

import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.common.dto.ApiResponse;
import com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException;
import com.sonnhuynhh.primewallet.common.service.AuditService;
import com.sonnhuynhh.primewallet.config.Web3jProvider;
import com.sonnhuynhh.primewallet.wallet.dto.*;
import com.sonnhuynhh.primewallet.wallet.entity.CryptoTransaction;
import com.sonnhuynhh.primewallet.wallet.enums.BlockchainNetwork;
import com.sonnhuynhh.primewallet.wallet.event.TransactionEvent;
import com.sonnhuynhh.primewallet.wallet.event.TransactionEventPublisher;
import com.sonnhuynhh.primewallet.wallet.service.CryptoWalletService;
import com.sonnhuynhh.primewallet.wallet.service.GasEstimationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.web3j.protocol.core.methods.response.EthGasPrice;
import org.web3j.protocol.core.methods.response.EthSendTransaction;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Controller xử lý giao dịch Crypto: gas price, estimate gas, broadcast.
 *
 * Base URL: /api/v1/crypto/transactions
 *
 * Kiến trúc Non-Custodial: client ký giao dịch offline (ethers.js)
 * → backend chỉ broadcast raw signed transaction + verify balance.
 */
@RestController
@RequestMapping("/api/v1/crypto/transactions")
@RequiredArgsConstructor
@Slf4j
public class CryptoTransactionController {

    /** Decimals mặc định khi client không gửi kèm — phần lớn ERC-20 dùng 18. */
    private static final int DEFAULT_TOKEN_DECIMALS = 18;

    private final Web3jProvider web3jProvider;
    private final GasEstimationService gasEstimationService;
    private final AuditService auditService;
    private final UserRepository userRepository;
    private final CryptoWalletService cryptoWalletService;
    private final TransactionEventPublisher transactionEventPublisher;

    private UUID getUserId(Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return user.getId();
    }

    // ==================== GAS ====================

    /**
     * Lấy gas price hiện tại của một mạng.
     */
    @GetMapping("/gas-price")
    public ResponseEntity<ApiResponse<GasPriceResponse>> getGasPrice(
            @RequestParam(defaultValue = "eth_sepolia") String network) {

        BlockchainNetwork net = BlockchainNetwork.fromIdWithLegacy(network);
        try {
            EthGasPrice gasPrice = web3jProvider.getWeb3j(net).ethGasPrice().send();
            return ResponseEntity.ok(ApiResponse.success("Phí Gas hiện tại",
                    GasPriceResponse.builder()
                            .blockchainNetwork(net.getId())
                            .gasPriceWei(gasPrice.getGasPrice())
                            .nativeSymbol(net.getNativeSymbol())
                            .build()));
        } catch (Exception e) {
            throw new RuntimeException("Failed to fetch gas price for " + net.getId(), e);
        }
    }

    /**
     * Ước tính gas cho giao dịch (native hoặc ERC-20) — hiển thị preview phí trước khi gửi.
     */
    @PostMapping("/estimate-gas")
    public ResponseEntity<ApiResponse<EstimateGasResponse>> estimateGas(
            @Valid @RequestBody EstimateGasRequest request) {

        BlockchainNetwork network = BlockchainNetwork.fromIdWithLegacy(request.getBlockchainNetwork());
        EstimateGasResponse response = (request.getTokenAddress() == null || request.getTokenAddress().isBlank())
                ? gasEstimationService.estimateNativeTransfer(network, request.getFromAddress(), request.getToAddress(), request.getAmount())
                : gasEstimationService.estimateTokenTransfer(network, request.getFromAddress(), request.getToAddress(),
                        request.getTokenAddress(), rawUnitsOfAmount(request.getAmount(), request.getTokenDecimals()));
        return ResponseEntity.ok(ApiResponse.success("Ước tính phí gas (chưa bao gồm phí broadcast của nền tảng)", response));
    }

    // ==================== BROADCAST ====================

    /**
     * Broadcast raw signed transaction lên mạng.
     * Client ký OFFLINE bằng ethers.js (signer.signTransaction / signMessage) → gửi hex.
     */
    @PostMapping("/broadcast")
    public ResponseEntity<ApiResponse<TransactionHashResponse>> broadcastTransaction(
            Authentication authentication,
            @Valid @RequestBody BroadcastTransactionRequest request,
            @RequestParam(defaultValue = "eth_sepolia") String blockchainNetwork) {

        BlockchainNetwork network = BlockchainNetwork.fromIdWithLegacy(blockchainNetwork);

        try {
            EthSendTransaction ethSendTransaction = web3jProvider.getWeb3j(network)
                    .ethSendRawTransaction(request.getSignedTransactionHex()).send();

            if (ethSendTransaction.hasError()) {
                throw new RuntimeException("Lỗi broadcast: " + ethSendTransaction.getError().getMessage());
            }

            UUID userId = getUserId(authentication);
            auditService.log(userId, "BROADCAST_CRYPTO_TX",
                    "Đẩy giao dịch Crypto lên mạng " + network.getLabel()
                            + " (Hash: " + ethSendTransaction.getTransactionHash() + ")", null);

            return ResponseEntity.ok(ApiResponse.success("Đẩy giao dịch lên mạng thành công",
                    new TransactionHashResponse(ethSendTransaction.getTransactionHash())));
        } catch (Exception e) {
            throw new RuntimeException("Failed to broadcast transaction — " + e.getMessage(), e);
        }
    }

    // ==================== SEND (broadcast + persist + kafka) ====================

    /**
     * Gửi token/native coin: broadcast signed tx, lưu vào lịch sử in-app,
     * phát event Kafka cho AI service. Non-custodial — client ký offline.
     */
    @PostMapping("/send")
    public ResponseEntity<ApiResponse<SendTransactionResponse>> sendToken(
            Authentication authentication,
            @Valid @RequestBody SendTokenRequest request) {

        BlockchainNetwork network = BlockchainNetwork.fromIdWithLegacy(request.getBlockchainNetwork());
        UUID userId = getUserId(authentication);

        // 1. Broadcast signed tx lên mạng
        EthSendTransaction ethSendTransaction;
        try {
            ethSendTransaction = web3jProvider.getWeb3j(network)
                    .ethSendRawTransaction(request.getSignedTransactionHex()).send();
        } catch (Exception e) {
            throw new RuntimeException("Failed to broadcast transaction — " + e.getMessage(), e);
        }

        String status;
        String txHash = null;
        if (ethSendTransaction.hasError()) {
            status = "FAILED";
            throw new RuntimeException("Lỗi broadcast: " + ethSendTransaction.getError().getMessage());
        }
        txHash = ethSendTransaction.getTransactionHash();
        status = "PENDING";

        // 2. Lưu giao dịch vào lịch sử in-app (để UI hiển thị)
        BigDecimal amount = new BigDecimal(request.getAmount());
        CryptoTransaction tx = CryptoTransaction.builder()
                .wallet(cryptoWalletService.findByOwnerAndAddress(
                        userId, request.getFromAddress(), network.getId()))
                .blockchainNetwork(network.getId())
                .type("SEND")
                .txHash(txHash)
                .fromAddress(request.getFromAddress())
                .toAddress(request.getToAddress())
                .amount(amount)
                .symbol(request.getSymbol())
                .tokenAddress(request.getTokenAddress() != null && !request.getTokenAddress().isBlank()
                        ? request.getTokenAddress() : null)
                .status(status)
                .description("Gửi " + request.getAmount() + " " + request.getSymbol()
                        + " trên " + network.getLabel())
                .build();

        CryptoTransaction saved = cryptoWalletService.saveTransaction(tx);

        // 3. Phát event Kafka — AI service tiêu thụ để tính risk score
        try {
            transactionEventPublisher.publish(TransactionEvent.builder()
                    .transactionId(saved.getId())
                    .userId(userId)
                    .referenceNumber("CRYPTO-" + txHash)
                    .transactionType("CRYPTO_SEND")
                    .sourceAccountNumber(request.getFromAddress())
                    .destinationAccountNumber(request.getToAddress())
                    .amount(amount)
                    .currency(request.getSymbol())
                    .status(status)
                    .description("Gửi " + request.getAmount() + " " + request.getSymbol()
                            + " trên " + network.getLabel())
                    .timestamp(LocalDateTime.now().toString())
                    .build());
        } catch (Exception e) {
            log.warn("Không gửi được Kafka event cho crypto tx: {}", e.getMessage());
        }

        auditService.log(userId, "SEND_CRYPTO_TX",
                "Gửi " + request.getAmount() + " " + request.getSymbol()
                        + " trên " + network.getLabel() + " (Hash: " + txHash + ")", null);

        return ResponseEntity.ok(ApiResponse.success("Giao dịch đã được đẩy lên mạng",
                SendTransactionResponse.builder()
                        .transactionHash(txHash)
                        .transactionId(saved.getId())
                        .status(status)
                        .build()));
    }

    // ==================== RECORD (ví ngoài tự broadcast) ====================

    /**
     * Ghi sổ giao dịch đã được ví ngoài (MetaMask/OKX/WalletConnect) phát lên mạng.
     *
     * <p>Ví ngoài giữ private key trong extension và tự broadcast qua
     * {@code eth_sendTransaction}, backend không có signed hex để phát lại. Endpoint
     * này chỉ lưu lịch sử in-app + phát Kafka event cho AI service, giữ cho lịch sử
     * và chấm điểm rủi ro đồng nhất giữa ví in-app và ví ngoài.
     */
    @PostMapping("/record")
    public ResponseEntity<ApiResponse<SendTransactionResponse>> recordTransaction(
            Authentication authentication,
            @Valid @RequestBody RecordTransactionRequest request) {

        BlockchainNetwork network = BlockchainNetwork.fromIdWithLegacy(request.getBlockchainNetwork());
        UUID userId = getUserId(authentication);

        BigDecimal amount = new BigDecimal(request.getAmount());
        String txType = (request.getType() != null && !request.getType().isBlank())
                ? request.getType().trim().toUpperCase()
                : "SEND";
        String description = request.getDescription() != null && !request.getDescription().isBlank()
                ? request.getDescription().trim()
                : "Gửi " + request.getAmount() + " " + request.getSymbol()
                        + " trên " + network.getLabel() + " (ví ngoài)";

        CryptoTransaction tx = CryptoTransaction.builder()
                .wallet(cryptoWalletService.findByOwnerAndAddress(
                        userId, request.getFromAddress(), network.getId()))
                .blockchainNetwork(network.getId())
                .type(txType)
                .txHash(request.getTransactionHash())
                .fromAddress(request.getFromAddress())
                .toAddress(request.getToAddress())
                .amount(amount)
                .symbol(request.getSymbol())
                .tokenAddress(request.getTokenAddress() != null && !request.getTokenAddress().isBlank()
                        ? request.getTokenAddress() : null)
                .status("PENDING")
                .description(description)
                .build();

        CryptoTransaction saved = cryptoWalletService.saveTransaction(tx);

        try {
            transactionEventPublisher.publish(TransactionEvent.builder()
                    .transactionId(saved.getId())
                    .userId(userId)
                    .referenceNumber("CRYPTO-" + request.getTransactionHash())
                    .transactionType("CRYPTO_SEND")
                    .sourceAccountNumber(request.getFromAddress())
                    .destinationAccountNumber(request.getToAddress())
                    .amount(amount)
                    .currency(request.getSymbol())
                    .status("PENDING")
                    .description("Gửi " + request.getAmount() + " " + request.getSymbol()
                            + " trên " + network.getLabel() + " (ví ngoài)")
                    .timestamp(LocalDateTime.now().toString())
                    .build());
        } catch (Exception e) {
            log.warn("Không gửi được Kafka event cho crypto tx (ví ngoài): {}", e.getMessage());
        }

        auditService.log(userId, "RECORD_CRYPTO_TX",
                "Ghi sổ giao dịch ví ngoài " + request.getAmount() + " " + request.getSymbol()
                        + " trên " + network.getLabel() + " (Hash: " + request.getTransactionHash() + ")", null);

        return ResponseEntity.ok(ApiResponse.success("Đã ghi nhận giao dịch",
                SendTransactionResponse.builder()
                        .transactionHash(request.getTransactionHash())
                        .transactionId(saved.getId())
                        .status("PENDING")
                        .build()));
    }

    // ==================== HELPERS ====================

    /**
     * Quy đổi số lượng token dạng thập phân ("12.5") về raw units theo đúng decimals
     * của token ("12500000" khi decimals = 6).
     *
     * <p>Trước đây hàm này cắt bỏ phần thập phân và bỏ qua decimals, nên "12.5" USDT
     * thành "12" raw unit = 0.000012 USDT — sai hoàn toàn khối lượng cần estimate.
     */
    private String rawUnitsOfAmount(String amount, Integer tokenDecimals) {
        int decimals = tokenDecimals == null ? DEFAULT_TOKEN_DECIMALS : tokenDecimals;
        try {
            BigDecimal raw = new BigDecimal(amount).movePointRight(decimals);
            if (raw.signum() < 0) {
                throw new IllegalArgumentException("Amount không được âm: " + amount);
            }
            // stripTrailingZeros + toBigIntegerExact: bắt lỗi khi số lẻ hơn decimals cho phép.
            return raw.stripTrailingZeros().toBigIntegerExact().toString();
        } catch (ArithmeticException e) {
            throw new IllegalArgumentException(
                    "Amount " + amount + " có nhiều hơn " + decimals + " số thập phân so với token cho phép");
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Amount không hợp lệ: " + amount);
        }
    }
}