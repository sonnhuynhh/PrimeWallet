package com.sonnhuynhh.primewallet.common.service;

import com.sonnhuynhh.primewallet.common.entity.AuditLog;
import com.sonnhuynhh.primewallet.common.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Service ghi log mọi hành động quan trọng vào bảng audit_logs.
 *
 * Tại sao dùng @Async (bất đồng bộ)?
 * → Ghi log KHÔNG được làm chậm giao dịch chính.
 * → Ví dụ: Khi user chuyển tiền, luồng chính cần:
 *     1. Trừ tiền ví gửi ✓
 *     2. Cộng tiền ví nhận ✓
 *     3. Trả response cho user ✓ (user thấy "Chuyển tiền thành công")
 *   → Ghi audit log chạy SONG SONG ở luồng khác (background thread).
 *   → Nếu ghi log fail (DB lỗi tạm thời), giao dịch vẫn thành công.
 *
 * Trade-off:
 * → Nếu server crash ngay sau giao dịch nhưng TRƯỚC khi ghi log xong
 *   → Có thể mất 1 dòng log (rất hiếm xảy ra).
 * → Chấp nhận được vì ta còn có Kafka event log làm backup.
 *
 * Để @Async hoạt động, cần bật @EnableAsync trên Application class.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    /**
     * Ghi log hành động bất đồng bộ.
     *
     * @param userId   ID của user thực hiện (null nếu chưa đăng nhập)
     * @param action   Loại hành động: LOGIN, TOPUP, TRANSFER, KYC_UPDATE, ...
     * @param detail   Mô tả chi tiết (ví dụ: "Nạp 500,000 VNĐ vào ví PW00001234")
     * @param ipAddress IP của client
     *
     * @Async: Method này chạy trên thread riêng, không block luồng chính.
     * Spring tự động quản lý thread pool (mặc định 8 threads).
     */
    @Async
    public void log(UUID userId, String action, String detail, String ipAddress) {
        try {
            AuditLog auditLog = AuditLog.builder()
                    .userId(userId)
                    .action(action)
                    .detail(detail)
                    .ipAddress(ipAddress)
                    .build();

            auditLogRepository.save(auditLog);
        } catch (Exception e) {
            // KHÔNG ném exception ra ngoài — tránh ảnh hưởng luồng chính
            // Chỉ ghi log lỗi vào console/file để DevOps biết
            log.error("❌ Không thể ghi audit log: action={}, userId={}, error={}",
                    action, userId, e.getMessage());
        }
    }

    /**
     * Ghi log cho hành động KHÔNG có user (ví dụ: đăng nhập thất bại).
     * Overload method để code gọi ngắn gọn hơn.
     */
    @Async
    public void log(String action, String detail, String ipAddress) {
        log(null, action, detail, ipAddress);
    }
}
