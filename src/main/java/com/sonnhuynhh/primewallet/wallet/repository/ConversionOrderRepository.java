package com.sonnhuynhh.primewallet.wallet.repository;

import com.sonnhuynhh.primewallet.wallet.entity.ConversionOrder;
import com.sonnhuynhh.primewallet.wallet.enums.ConversionOrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ConversionOrderRepository extends JpaRepository<ConversionOrder, UUID> {

    Page<ConversionOrder> findByUser_IdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Optional<ConversionOrder> findByIdAndUser_Id(UUID id, UUID userId);

    Optional<ConversionOrder> findByDepositTxHash(String depositTxHash);

    long countByUser_IdAndStatus(UUID userId, ConversionOrderStatus status);
}
