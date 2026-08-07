package com.sonnhuynhh.primewallet.common.exception;

/**
 * Exception khi user cố truy cập tài nguyên KHÔNG thuộc quyền sở hữu của mình.
 *
 * Ví dụ (Fix #5 - IDOR): User A gọi GET /history/{accountId} với accountId của User B.
 * → Phải bị CHẶN, không được phép xem lịch sử giao dịch của người khác.
 *
 * HTTP Status: 403 Forbidden
 * (User đã xác thực JWT thành công, nhưng KHÔNG có quyền trên tài nguyên này.)
 */
public class UnauthorizedAccessException extends RuntimeException {
    public UnauthorizedAccessException(String message) {
        super(message);
    }
}
