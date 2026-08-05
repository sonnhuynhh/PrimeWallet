package com.sonnhuynhh.primewallet.common.repository;

import com.sonnhuynhh.primewallet.common.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * Repository cho AuditLog.
 *
 * Chủ yếu dùng để INSERT (ghi log) và SELECT (tra cứu log).
 * KHÔNG có method delete — audit log không bao giờ bị xóa.
 */
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    /**
     * Tìm tất cả log của 1 user (phân trang, sắp xếp theo thời gian mới nhất).
     * Dùng khi Admin muốn xem lịch sử hành động của user cụ thể.
     */
    Page<AuditLog> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    /**
     * Tìm log theo loại hành động (phân trang).
     * Dùng khi muốn xem tất cả hành động LOGIN_FAILED để phát hiện brute-force.
     */
    Page<AuditLog> findByActionOrderByCreatedAtDesc(String action, Pageable pageable);
}
