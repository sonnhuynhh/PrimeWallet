package com.sonnhuynhh.primewallet.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Entity lưu trữ Refresh Token trong database.
 *
 * Tại sao cần Refresh Token?
 * - Access Token (JWT) có thời hạn ngắn (~15 phút) để giảm rủi ro nếu bị lộ.
 * - Khi Access Token hết hạn, client dùng Refresh Token để lấy Access Token mới
 *   mà không cần đăng nhập lại.
 * - Refresh Token lưu trong DB để có thể thu hồi (revoke) khi cần
 *   (VD: User đổi mật khẩu, phát hiện bất thường → thu hồi tất cả token).
 */
@Entity
@Table(name = "refresh_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, unique = true, length = 500)
    private String token;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "is_revoked")
    @Builder.Default
    private boolean isRevoked = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /**
     * Kiểm tra token đã hết hạn chưa.
     */
    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }

    /**
     * Kiểm tra token có còn hợp lệ không (chưa hết hạn VÀ chưa bị thu hồi).
     */
    public boolean isValid() {
        return !isExpired() && !isRevoked;
    }
}
