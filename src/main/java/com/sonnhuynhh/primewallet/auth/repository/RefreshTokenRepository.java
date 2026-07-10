package com.sonnhuynhh.primewallet.auth.repository;

import com.sonnhuynhh.primewallet.auth.entity.RefreshToken;
import com.sonnhuynhh.primewallet.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository quản lý Refresh Token.
 */
@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    /**
     * Tìm refresh token theo giá trị token string.
     * Dùng khi client gửi refresh token để lấy access token mới.
     */
    Optional<RefreshToken> findByToken(String token);

    /**
     * Thu hồi (revoke) tất cả refresh token của một user.
     * Dùng khi user đổi mật khẩu hoặc phát hiện bất thường.
     */
    @Modifying
    @Query("UPDATE RefreshToken rt SET rt.isRevoked = true WHERE rt.user = :user AND rt.isRevoked = false")
    void revokeAllByUser(User user);
}
