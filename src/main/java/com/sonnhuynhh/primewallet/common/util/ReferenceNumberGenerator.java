package com.sonnhuynhh.primewallet.common.util;

import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Utility tạo mã tham chiếu duy nhất cho hệ thống.
 *
 * Tại sao không dùng UUID cho mã hiển thị?
 * - UUID dài và khó đọc: "550e8400-e29b-41d4-a716-446655440000"
 * - Khi user gọi hotline hỗ trợ, họ cần đọc mã giao dịch → cần mã ngắn, dễ đọc.
 * - Mã có cấu trúc (ngày + random) giúp debug nhanh hơn.
 */
@Component
public class ReferenceNumberGenerator {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");

    /**
     * Tạo số tài khoản ví.
     * Format: PW + 8 chữ số random.
     * VD: "PW00001234", "PW98765432"
     */
    public String generateAccountNumber() {
        int random = ThreadLocalRandom.current().nextInt(10_000_000, 99_999_999);
        return "PW" + String.format("%08d", random);
    }

    /**
     * Tạo mã tham chiếu giao dịch.
     * Format: TXN + ngày (yyyyMMdd) + 6 chữ số random.
     * VD: "TXN20260711123456"
     *
     * Cấu trúc này giúp:
     * - Biết giao dịch tạo ngày nào chỉ nhìn mã
     * - Debug và tra cứu nhanh theo ngày
     */
    public String generateTransactionReference() {
        String date = LocalDate.now().format(DATE_FORMAT);
        int random = ThreadLocalRandom.current().nextInt(100_000, 999_999);
        return "TXN" + date + random;
    }
}
