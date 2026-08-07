package com.sonnhuynhh.primewallet.wallet.entity;

import com.sonnhuynhh.primewallet.auth.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Entity đại diện cho Ví Crypto được liên kết của người dùng.
 * Sử dụng cho kiến trúc Non-Custodial (chỉ lưu public address).
 */
@Entity
@Table(name = "crypto_wallets", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "wallet_address", "blockchain_network"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CryptoWallet {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "wallet_address", nullable = false, unique = true, length = 42)
    private String walletAddress;

    @Column(name = "blockchain_network", nullable = false, length = 30)
    private String blockchainNetwork; // e.g., eth_sepolia, bsc_testnet

    /** Role của ví: PRIMARY (mặc định) hoặc SECONDARY (thêm thủ công). */
    @Column(name = "is_primary", nullable = false)
    @Builder.Default
    private boolean primary = false;

    /** Tên hiển thị do người dùng đặt (VD: "Ví chính", "Ví tiết kiệm"). */
    @Column(name = "label", length = 60)
    private String label;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
