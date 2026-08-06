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
        @UniqueConstraint(columnNames = {"user_id", "blockchain_network"})
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

    @Column(name = "blockchain_network", nullable = false, length = 20)
    private String blockchainNetwork; // e.g., ETH_SEPOLIA, BSC_TESTNET

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
