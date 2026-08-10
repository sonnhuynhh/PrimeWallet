package com.sonnhuynhh.primewallet.wallet.entity;

import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.wallet.enums.ConversionOrderStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Lệnh bán crypto → nhận VND trên ví Fiat.
 * User gửi token/ETH tới treasury on-chain, backend xác minh tx rồi topUp VND.
 */
@Entity
@Table(name = "conversion_orders", indexes = {
        @Index(name = "idx_conversion_orders_user", columnList = "user_id"),
        @Index(name = "idx_conversion_orders_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversionOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "crypto_wallet_id", nullable = false)
    private UUID cryptoWalletId;

    @Column(name = "blockchain_network", nullable = false, length = 40)
    private String blockchainNetwork;

    @Column(name = "from_address", nullable = false, length = 42)
    private String fromAddress;

    @Column(name = "token_symbol", nullable = false, length = 20)
    private String tokenSymbol;

    @Column(name = "token_address", length = 42)
    private String tokenAddress;

    /** Số lượng token (đã chia decimals). */
    @Column(name = "token_amount", nullable = false, precision = 38, scale = 18)
    private BigDecimal tokenAmount;

    /** Raw amount (wei / smallest unit) — dùng đối chiếu on-chain. */
    @Column(name = "token_amount_raw", nullable = false, length = 80)
    private String tokenAmountRaw;

    @Column(name = "vnd_amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal vndAmount;

    @Column(name = "rate_vnd", nullable = false, precision = 18, scale = 2)
    private BigDecimal rateVnd;

    @Column(name = "treasury_address", nullable = false, length = 42)
    private String treasuryAddress;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ConversionOrderStatus status = ConversionOrderStatus.PENDING_DEPOSIT;

    @Column(name = "deposit_tx_hash", length = 80)
    private String depositTxHash;

    @Column(name = "fiat_tx_id")
    private UUID fiatTransactionId;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
