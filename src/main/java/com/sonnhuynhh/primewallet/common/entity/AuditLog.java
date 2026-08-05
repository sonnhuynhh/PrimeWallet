package com.sonnhuynhh.primewallet.common.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Entity ghi log mọi hành động quan trọng trong hệ thống.
 *
 * Tại sao cần Audit Log?
 * → Trong lĩnh vực tài chính, mọi thao tác quan trọng PHẢI được ghi lại:
 *   - Ai đã thực hiện? (userId)
 *   - Thực hiện hành động gì? (action)
 *   - Chi tiết cụ thể? (detail)
 *   - Từ đâu? (ipAddress)
 *   - Khi nào? (createdAt)
 *
 * Mục đích sử dụng:
 * 1. Truy vết sự cố: "Ai đã chuyển 100 triệu lúc 3h sáng?"
 * 2. Tuân thủ pháp luật: Ngân hàng Nhà nước yêu cầu lưu log giao dịch 5 năm
 * 3. Phát hiện gian lận: Phân tích log để tìm hành vi bất thường
 * 4. Hỗ trợ khiếu nại: Khi user khiếu nại, tra log để xác nhận sự thật
 *
 * Lưu ý: Bảng này chỉ INSERT, KHÔNG BAO GIỜ UPDATE hoặc DELETE.
 * → Đảm bảo tính toàn vẹn của dấu vết kiểm toán (audit trail).
 */
@Entity
@Table(name = "audit_logs", indexes = {
        // Index giúp truy vấn nhanh theo userId và action
        // Ví dụ: "Tìm tất cả hành động LOGIN của user X trong tháng 7"
        @Index(name = "idx_audit_user_id", columnList = "user_id"),
        @Index(name = "idx_audit_action", columnList = "action"),
        @Index(name = "idx_audit_created_at", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * ID của user thực hiện hành động.
     * Có thể null nếu hành động xảy ra trước khi đăng nhập
     * (ví dụ: đăng nhập thất bại — chưa biết user là ai).
     */
    @Column(name = "user_id")
    private UUID userId;

    /**
     * Loại hành động. Dùng String thay vì Enum để dễ mở rộng
     * mà không cần sửa code khi thêm action mới.
     *
     * Các giá trị hiện tại:
     * - LOGIN, LOGIN_FAILED, REGISTER
     * - CHANGE_PASSWORD
     * - TOPUP, WITHDRAW, TRANSFER
     * - KYC_UPDATE, LOCK_USER, UNLOCK_USER
     */
    @Column(nullable = false, length = 50)
    private String action;

    /**
     * Chi tiết hành động (tùy chọn, tối đa 1000 ký tự).
     * Ví dụ: "Nạp 500,000 VNĐ vào ví PW00001234"
     *         "Admin cập nhật KYC → VERIFIED"
     */
    @Column(length = 1000)
    private String detail;

    /**
     * Địa chỉ IP của client thực hiện hành động.
     * Dùng để truy vết vị trí và phát hiện đăng nhập bất thường.
     */
    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    /**
     * Thời điểm hành động xảy ra.
     * @CreationTimestamp: Hibernate tự động gán = thời điểm INSERT.
     * updatable = false: Không cho phép sửa sau khi tạo.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
