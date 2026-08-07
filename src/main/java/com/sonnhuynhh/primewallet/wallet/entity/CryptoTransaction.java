package com.sonnhuynhh.primewallet.wallet.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Entity lưu lịch sử giao dịch Crypto mà user thực hiện qua app PrimeWallet.
 *
 * Khác với EtherscanTransaction (lịch sử on-chain đầy đủ), bảng này
 * chỉ lưu các giao dịch CHÍNH MÌNH THỰC HIỆN (send/swap) có trạng thái:
 * PENDING (đang xử lý), SUCCESS, FAILED.
 *
 * Dùng để hiển thị "Lịch sử giao dịch của tôi" + theo dõi trạng thái pending/confirmed.
 */
@Entity
@Table(name = "crypto_transactions", indexes = {
        @Index(name = "idx_crypto_tx_wallet", columnList = "wallet_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CryptoTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "wallet_id", nullable = false)
    private CryptoWallet wallet;

    @Column(nullable = false, length = 30)
    private String blockchainNetwork;

    /** Loại giao dịch: SEND, IMPORTED (vec interface nạp ví chuyển từ ngoài). */
    @Column(name = "tx_type", nullable = false, length = 20)
    private String type; // SEND

    @Column(name = "tx_hash", length = 80)
    private String txHash;

    /** Địa chỉ người nhận (cho SEND). */
    @Column(name = "to_address", length = 42)
    private String toAddress;

    /** Địa chỉ người gửi. */
    @Column(name = "from_address", length = 42)
    private String fromAddress;

    @Column(nullable = false, precision = 38, scale = 18)
    private BigDecimal amount;

    /** Ký hiệu token gửi (ETH, USDT, USDC...). */
    @Column(nullable = false, length = 10)
    private String symbol;

    /** Địa chỉ contract ERC-20 (null nếu là native coin ETH/BNB). */
    @Column(name = "token_address", length = 42)
    private String tokenAddress;

    /** Gas price (wei) tại thời điểm gửi. */
    @Column(name = "gas_price_wei")
    private Long gasPriceWei;

    /** Gas limit ước tính. */
    @Column(name = "gas_limit")
    private Long gasLimit;

    /** Phí giao dịch (wei). */
    @Column(name = "fee_wei")
    private Long feeWei;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING"; // PENDING, SUCCESS, FAILED, CONFIRMED

    @Column(length = 500)
    private String description;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}