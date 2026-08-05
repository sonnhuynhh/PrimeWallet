package com.sonnhuynhh.primewallet.payment.util;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Map;

/**
 * Tiện ích hỗ trợ mã hóa cho VNPAY.
 */
public class VnpayUtil {

    /**
     * Tạo mã hash (chữ ký) bằng thuật toán HMAC SHA-512.
     * Đây là thuật toán VNPAY bắt buộc dùng để đảm bảo dữ liệu không bị hacker thay đổi dọc đường.
     *
     * @param key Cờ bí mật (vnp_HashSecret)
     * @param data Dữ liệu cần mã hóa (chuỗi query string)
     * @return Mã băm HEX
     */
    public static String hmacSHA512(final String key, final String data) {
        try {
            if (key == null || data == null) {
                throw new NullPointerException();
            }
            final Mac hmac512 = Mac.getInstance("HmacSHA512");
            byte[] hmacKeyBytes = key.getBytes();
            final SecretKeySpec secretKey = new SecretKeySpec(hmacKeyBytes, "HmacSHA512");
            hmac512.init(secretKey);
            byte[] dataBytes = data.getBytes(StandardCharsets.UTF_8);
            byte[] result = hmac512.doFinal(dataBytes);
            StringBuilder sb = new StringBuilder(2 * result.length);
            for (byte b : result) {
                sb.append(String.format("%02x", b & 0xff));
            }
            return sb.toString();

        } catch (Exception ex) {
            return "";
        }
    }

    /**
     * Chuyển đổi Map chứa các tham số VNPAY thành một Query String
     * được sắp xếp theo bảng chữ cái.
     * VNPAY yêu cầu tham số phải được sắp xếp trước khi băm (hash).
     */
    public static String hashAllFields(Map<String, String> fields, String secretKey) {
        // Tạo chuỗi query data từ các field (BẮT BUỘC SẮP XẾP)
        java.util.List<String> fieldNames = new java.util.ArrayList<>(fields.keySet());
        java.util.Collections.sort(fieldNames);
        StringBuilder hashData = new StringBuilder();
        Iterator<String> itr = fieldNames.iterator();
        while (itr.hasNext()) {
            String fieldName = itr.next();
            String fieldValue = fields.get(fieldName);
            if ((fieldValue != null) && (fieldValue.length() > 0)) {
                // Thêm vào chuỗi hash
                hashData.append(fieldName);
                hashData.append('=');
                try {
                    hashData.append(java.net.URLEncoder.encode(fieldValue, StandardCharsets.US_ASCII.toString()));
                } catch (Exception e) {
                    hashData.append(fieldValue);
                }
                if (itr.hasNext()) {
                    hashData.append('&');
                }
            }
        }
        return hmacSHA512(secretKey, hashData.toString());
    }
}
