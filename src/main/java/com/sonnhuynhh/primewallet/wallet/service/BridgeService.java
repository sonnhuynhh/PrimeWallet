package com.sonnhuynhh.primewallet.wallet.service;

import com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException;
import com.sonnhuynhh.primewallet.common.exception.UnauthorizedAccessException;
import com.sonnhuynhh.primewallet.config.BridgeProperties;
import com.sonnhuynhh.primewallet.wallet.dto.*;
import com.sonnhuynhh.primewallet.wallet.entity.ConversionOrder;
import com.sonnhuynhh.primewallet.wallet.entity.CryptoWallet;
import com.sonnhuynhh.primewallet.wallet.enums.BlockchainNetwork;
import com.sonnhuynhh.primewallet.wallet.enums.ConversionOrderStatus;
import com.sonnhuynhh.primewallet.wallet.repository.ConversionOrderRepository;
import com.sonnhuynhh.primewallet.wallet.repository.CryptoWalletRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Bridge bán crypto → cộng VND vào ví Fiat.
 *
 * Luồng: báo giá → user gửi on-chain tới treasury → xác minh tx → topUp VND.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BridgeService {

    private static final BigDecimal MIN_VND = new BigDecimal("1000");

    private final BridgeProperties bridgeProperties;
    private final BridgeRateService bridgeRateService;
    private final ConversionOrderRepository conversionOrderRepository;
    private final CryptoWalletRepository cryptoWalletRepository;
    private final BridgeDepositVerifier depositVerifier;
    private final TransactionService transactionService;

    public BridgeRatesResponse getRatesForNetwork(String networkId) {
        ensureEnabled();
        return bridgeRateService.getRatesForNetwork(networkId);
    }

    @Transactional
    public BridgeQuoteResponse createQuote(BridgeQuoteRequest request, UUID userId) {
        ensureEnabled();

        CryptoWallet wallet = cryptoWalletRepository.findById(request.getCryptoWalletId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ví crypto"));
        if (!wallet.getUser().getId().equals(userId)) {
            throw new UnauthorizedAccessException("Ví crypto không thuộc tài khoản này");
        }

        BlockchainNetwork network = BlockchainNetwork.fromIdWithLegacy(wallet.getBlockchainNetwork());
        String treasury = resolveTreasury(network.getId());
        BigDecimal rate = bridgeRateService.getRateVnd(network, request.getTokenSymbol());
        if (rate == null || rate.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Chưa hỗ trợ đổi token " + request.getTokenSymbol()
                    + " trên mạng " + network.getLabel());
        }

        boolean isNative = request.getTokenAddress() == null || request.getTokenAddress().isBlank();
        int decimals = isNative ? 18 : requireDecimals(request);
        BigDecimal tokenAmount = new BigDecimal(request.getAmount().trim());
        if (tokenAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Số lượng token phải lớn hơn 0");
        }

        BigInteger amountRaw = toRawAmount(tokenAmount, decimals);
        BigDecimal vndAmount = tokenAmount.multiply(rate).setScale(0, RoundingMode.DOWN);
        if (vndAmount.compareTo(MIN_VND) < 0) {
            throw new IllegalArgumentException("Giá trị quy đổi tối thiểu là " + MIN_VND + " VND");
        }

        LocalDateTime expiresAt = LocalDateTime.now().plusSeconds(bridgeProperties.getQuoteTtlSeconds());

        ConversionOrder order = ConversionOrder.builder()
                .user(wallet.getUser())
                .cryptoWalletId(wallet.getId())
                .blockchainNetwork(network.getId())
                .fromAddress(wallet.getWalletAddress())
                .tokenSymbol(request.getTokenSymbol().toUpperCase())
                .tokenAddress(isNative ? null : request.getTokenAddress().trim())
                .tokenAmount(tokenAmount)
                .tokenAmountRaw(amountRaw.toString())
                .vndAmount(vndAmount)
                .rateVnd(rate)
                .treasuryAddress(treasury)
                .status(ConversionOrderStatus.PENDING_DEPOSIT)
                .expiresAt(expiresAt)
                .build();
        order = conversionOrderRepository.save(order);

        log.info("Bridge quote {} — {} {} → {} VND (user={})",
                order.getId(), tokenAmount, order.getTokenSymbol(), vndAmount, userId);

        return toQuoteResponse(order);
    }

    @Transactional
    public BridgeOrderResponse confirmOrder(UUID orderId, BridgeConfirmRequest request, UUID userId) {
        ensureEnabled();

        ConversionOrder order = conversionOrderRepository.findByIdAndUser_Id(orderId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lệnh đổi"));

        if (order.getStatus() == ConversionOrderStatus.CREDITED) {
            return toOrderResponse(order);
        }

        if (order.getStatus() != ConversionOrderStatus.PENDING_DEPOSIT) {
            throw new IllegalStateException("Lệnh đổi không còn ở trạng thái chờ nạp");
        }

        if (order.getExpiresAt().isBefore(LocalDateTime.now())) {
            order.setStatus(ConversionOrderStatus.EXPIRED);
            conversionOrderRepository.save(order);
            throw new IllegalStateException("Báo giá đã hết hạn. Vui lòng tạo báo giá mới.");
        }

        String txHash = request.getTxHash().trim();
        if (conversionOrderRepository.findByDepositTxHash(txHash).isPresent()) {
            throw new IllegalStateException("Giao dịch này đã được sử dụng cho lệnh đổi khác");
        }

        BlockchainNetwork network = BlockchainNetwork.fromIdWithLegacy(order.getBlockchainNetwork());
        try {
            depositVerifier.verify(
                    network,
                    txHash,
                    order.getFromAddress(),
                    order.getTreasuryAddress(),
                    order.getTokenAddress(),
                    new BigInteger(order.getTokenAmountRaw())
            );
        } catch (Exception ex) {
            log.warn("Bridge verify failed order={} tx={}: {}", orderId, txHash, ex.getMessage());
            throw new IllegalArgumentException(
                    ex.getMessage() != null ? ex.getMessage() : "Không xác minh được giao dịch on-chain");
        }

        UUID idempotencyKey = UUID.nameUUIDFromBytes(
                ("bridge-credit-" + order.getId()).getBytes(StandardCharsets.UTF_8));

        TopUpRequest topUpRequest = TopUpRequest.builder()
                .idempotencyKey(idempotencyKey)
                .amount(order.getVndAmount())
                .description(String.format(
                        "Đổi %s %s → VND (tx %s)",
                        order.getTokenAmount().stripTrailingZeros().toPlainString(),
                        order.getTokenSymbol(),
                        shortenHash(txHash)))
                .build();

        TransactionResponse fiatTx = transactionService.topUp(topUpRequest, userId);

        order.setDepositTxHash(txHash);
        order.setFiatTransactionId(fiatTx.getId());
        order.setStatus(ConversionOrderStatus.CREDITED);
        conversionOrderRepository.save(order);

        log.info("Bridge credited order={} tx={} vnd={}", orderId, txHash, order.getVndAmount());
        return toOrderResponse(order);
    }

    @Transactional(readOnly = true)
    public Page<BridgeOrderResponse> listOrders(UUID userId, Pageable pageable) {
        return conversionOrderRepository.findByUser_IdOrderByCreatedAtDesc(userId, pageable)
                .map(this::toOrderResponse);
    }

    private void ensureEnabled() {
        if (!bridgeProperties.isEnabled()) {
            throw new IllegalStateException("Tính năng đổi Crypto → Fiat đang tắt");
        }
    }

    private String resolveTreasury(String networkId) {
        String treasury = bridgeProperties.getTreasury().get(networkId);
        if (treasury == null || treasury.isBlank()) {
            throw new IllegalStateException(
                    "Chưa cấu hình ví treasury cho mạng " + networkId
                            + ". Liên hệ quản trị viên.");
        }
        return treasury.trim();
    }

    private static int requireDecimals(BridgeQuoteRequest request) {
        if (request.getTokenDecimals() == null || request.getTokenDecimals() < 0) {
            throw new IllegalArgumentException("tokenDecimals bắt buộc khi đổi ERC-20");
        }
        return request.getTokenDecimals();
    }

    private static BigInteger toRawAmount(BigDecimal humanAmount, int decimals) {
        try {
            return humanAmount.movePointRight(decimals).toBigIntegerExact();
        } catch (ArithmeticException ex) {
            throw new IllegalArgumentException("Số lượng token có quá nhiều chữ số thập phân");
        }
    }

    private BridgeQuoteResponse toQuoteResponse(ConversionOrder order) {
        return BridgeQuoteResponse.builder()
                .orderId(order.getId())
                .blockchainNetwork(order.getBlockchainNetwork())
                .fromAddress(order.getFromAddress())
                .tokenSymbol(order.getTokenSymbol())
                .tokenAddress(order.getTokenAddress())
                .tokenAmount(order.getTokenAmount().stripTrailingZeros().toPlainString())
                .tokenAmountRaw(order.getTokenAmountRaw())
                .vndAmount(order.getVndAmount())
                .rateVnd(order.getRateVnd())
                .treasuryAddress(order.getTreasuryAddress())
                .expiresAt(order.getExpiresAt())
                .rateSource(bridgeRateService.currentSource())
                .rateUpdatedAt(bridgeRateService.currentUpdatedAt())
                .build();
    }

    private BridgeOrderResponse toOrderResponse(ConversionOrder order) {
        return BridgeOrderResponse.builder()
                .id(order.getId())
                .status(order.getStatus().name())
                .blockchainNetwork(order.getBlockchainNetwork())
                .fromAddress(order.getFromAddress())
                .tokenSymbol(order.getTokenSymbol())
                .tokenAddress(order.getTokenAddress())
                .tokenAmount(order.getTokenAmount().stripTrailingZeros().toPlainString())
                .vndAmount(order.getVndAmount())
                .rateVnd(order.getRateVnd())
                .treasuryAddress(order.getTreasuryAddress())
                .depositTxHash(order.getDepositTxHash())
                .fiatTransactionId(order.getFiatTransactionId())
                .expiresAt(order.getExpiresAt())
                .createdAt(order.getCreatedAt())
                .build();
    }

    private static String shortenHash(String hash) {
        if (hash.length() <= 12) return hash;
        return hash.substring(0, 8) + "…" + hash.substring(hash.length() - 6);
    }
}
