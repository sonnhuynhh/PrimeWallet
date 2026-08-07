package com.sonnhuynhh.primewallet.payment.repository;

import com.sonnhuynhh.primewallet.payment.entity.PaymentOrder;
import com.sonnhuynhh.primewallet.payment.enums.PaymentOrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository cho PaymentOrder (đơn thanh toán VNPAY).
 */
@Repository
public interface PaymentOrderRepository extends JpaRepository<PaymentOrder, UUID> {

    /**
     * Tra cứu đơn theo mã giao dịch VNPAY. Dùng khi xử lý IPN/return.
     */
    Optional<PaymentOrder> findByTxnRef(String txnRef);

    /**
     * Danh sách đơn theo trạng thái — Admin dùng để đối soát các đơn FAILED.
     */
    List<PaymentOrder> findByStatus(PaymentOrderStatus status);
}
