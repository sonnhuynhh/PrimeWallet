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
import java.math.BigInteger;
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
                        request.getTokenAddress(), weiOfAmount(request.getAmount()));
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
                .wallet(cryptoWalletService.findByOwnerAndAddress(userId, request.getFromAddress()))
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

    // ==================== HELPERS ====================

    private String weiOfAmount(String amount) {
        // Chuyển số thập phân (VD "100") về chuỗi số nguyên raw units cho estimate gas token.
        try {
            return new java.math.BigDecimal(amount).toBigInteger().toString();
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Amount không hợp lệ: " + amount);
        }
    }
}