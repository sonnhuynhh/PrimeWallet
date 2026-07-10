package com.sonnhuynhh.primewallet.common.exception;

/**
 * Ném ra khi không tìm thấy resource (User, Account, Transaction, ...).
 * Trả về HTTP 404.
 */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
