package com.sonnhuynhh.primewallet.common.exception;

/**
 * Exception khi user bị khóa tài khoản nhưng cố thực hiện giao dịch.
 *
 * Khi Admin gọi API lock user → user.status = "LOCKED"
 * → Mọi giao dịch (nạp, rút, chuyển) đều bị chặn → ném exception này.
 *
 * HTTP Status: 403 Forbidden
 * (Giống KycRequiredException — user đã xác thực danh tính JWT thành công,
 *  nhưng BỊ CẤM thực hiện hành động do trạng thái tài khoản).
 */
public class AccountLockedException extends RuntimeException {
    public AccountLockedException(String message) {
        super(message);
    }
}
