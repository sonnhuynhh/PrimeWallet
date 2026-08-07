package com.sonnhuynhh.primewallet.wallet.repository;

import com.sonnhuynhh.primewallet.wallet.entity.CryptoTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CryptoTransactionRepository extends JpaRepository<CryptoTransaction, UUID> {

    Page<CryptoTransaction> findByWalletIdOrderByCreatedAtDesc(UUID walletId, Pageable pageable);

    List<CryptoTransaction> findByWalletId(UUID walletId);

    List<CryptoTransaction> findByWalletIdAndStatus(UUID walletId, String status);
}