package com.sonnhuynhh.primewallet.common.exception;

/**
 * Ném ra khi phát hiện giao dịch trùng lặp (idempotency_key đã tồn tại).
 * Đây là cơ chế chống giao dịch lặp khi client retry request.
 * Trả về HTTP 409 Conflict.
 */
public class DuplicateTransactionException extends RuntimeException {
    public DuplicateTransactionException(String message) {
        super(message);
    }
}
