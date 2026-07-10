package com.sonnhuynhh.primewallet.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Entity đại diện cho người dùng trong hệ thống PrimeWallet.
 *
 * Mỗi User khi đăng ký sẽ:
 * - Có role mặc định là USER
 * - Có trạng thái KYC là PENDING (chưa xác thực)
 * - Có trạng thái tài khoản là ACTIVE
 *
 * Lưu ý:
 * - password_hash lưu mật khẩu đã được mã hóa bằng BCrypt
 * - email và phone đều là UNIQUE (không cho phép trùng)
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false, unique = true, length = 20)
    private String phone;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Enumerated(EnumType.STRING)
    @Column(name = "kyc_status", length = 20)
    @Builder.Default
    private KycStatus kycStatus = KycStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private Role role = Role.USER;

    @Column(length = 20)
    @Builder.Default
    private String status = "ACTIVE";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
