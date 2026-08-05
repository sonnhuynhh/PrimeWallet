package com.sonnhuynhh.primewallet.payment.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.TimeZone;

/**
 * Cấu hình VNPAY.
 * Tự động đọc các biến từ application.properties.
 */
@Configuration
@Getter
public class VnpayConfig {

    @Value("${vnpay.url}")
    private String vnpayUrl;

    @Value("${vnpay.return-url}")
    private String vnpayReturnUrl;

    @Value("${vnpay.tmn-code}")
    private String tmnCode;

    @Value("${vnpay.hash-secret}")
    private String secretKey;

    public static final String VNP_VERSION = "2.1.0";
    public static final String VNP_COMMAND = "pay";
    public static final String VNP_CURRENCY = "VND";
    public static final String VNP_LOCALE = "vn";

    /**
     * Tạo mã giao dịch (TxnRef) độc nhất.
     * VNPAY yêu cầu mỗi giao dịch phải có 1 mã TxnRef duy nhất trong ngày.
     */
    public static String getRandomNumber(int len) {
        String chars = "0123456789";
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) {
            sb.append(chars.charAt((int) (Math.random() * chars.length())));
        }
        return sb.toString();
    }
}
