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

    /**
     * Ví của user trên một mạng. Trả List vì một user có thể liên kết nhiều địa chỉ
     * khác nhau trên cùng một mạng — kiểu Optional trước đây sẽ ném
     * NonUniqueResultException ngay khi user link địa chỉ thứ hai cùng mạng.
     */
    List<CryptoWallet> findByUserIdAndBlockchainNetwork(UUID userId, String blockchainNetwork);

    List<CryptoWallet> findByWalletAddress(String walletAddress);

    /** Chủ sở hữu của một cặp (địa chỉ, mạng) — dùng để chặn chiếm địa chỉ người khác. */
    Optional<CryptoWallet> findByWalletAddressAndBlockchainNetwork(String walletAddress, String blockchainNetwork);

    List<CryptoWallet> findByWalletAddressAndUser_Id(String walletAddress, UUID userId);

    /** Ví của user theo đúng cặp (địa chỉ, mạng) — khoá tự nhiên sau khi cho phép multi-network. */
    Optional<CryptoWallet> findByWalletAddressAndBlockchainNetworkAndUser_Id(
            String walletAddress, String blockchainNetwork, UUID userId);

    void deleteByIdAndUser_Id(UUID walletId, UUID userId);
}