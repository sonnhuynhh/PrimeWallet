package com.sonnhuynhh.primewallet.auth.entity;

/**
 * Enum trạng thái KYC (Know Your Customer - Xác thực danh tính).
 * - PENDING: Chưa xác thực (mới đăng ký)
 * - VERIFIED: Đã xác thực thành công
 * - REJECTED: Bị từ chối xác thực
 */
public enum KycStatus {
    PENDING,
    VERIFIED,
    REJECTED
}
