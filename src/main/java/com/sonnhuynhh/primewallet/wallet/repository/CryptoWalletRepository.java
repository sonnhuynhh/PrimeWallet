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

    /** Danh sách ví của user, ví PRIMARY lên trước, sau đó theo thời gian tạo. */
    List<CryptoWallet> findByUserIdOrderByPrimaryDescCreatedAtAsc(UUID userId);

    Optional<CryptoWallet> findByUserIdAndBlockchainNetwork(UUID userId, String blockchainNetwork);

    List<CryptoWallet> findByWalletAddress(String walletAddress);

    Optional<CryptoWallet> findByWalletAddressAndUser_Id(String walletAddress, UUID userId);

    void deleteByIdAndUser_Id(UUID walletId, UUID userId);
}