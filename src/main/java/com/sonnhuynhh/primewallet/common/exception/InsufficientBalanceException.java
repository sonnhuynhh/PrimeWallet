package com.sonnhuynhh.primewallet.common.exception;

/**
 * Ném ra khi số dư tài khoản không đủ để thực hiện giao dịch.
 * Trả về HTTP 400 Bad Request.
 */
public class InsufficientBalanceException extends RuntimeException {
    public InsufficientBalanceException(String message) {
        super(message);
    }
}
