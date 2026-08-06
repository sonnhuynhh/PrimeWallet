package com.sonnhuynhh.primewallet.wallet.repository;

import com.sonnhuynhh.primewallet.wallet.entity.CryptoWallet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CryptoWalletRepository extends JpaRepository<CryptoWallet, UUID> {
    
    List<CryptoWallet> findByUserId(UUID userId);
    
    Optional<CryptoWallet> findByUserIdAndBlockchainNetwork(UUID userId, String blockchainNetwork);
    
    boolean existsByWalletAddress(String walletAddress);
}
