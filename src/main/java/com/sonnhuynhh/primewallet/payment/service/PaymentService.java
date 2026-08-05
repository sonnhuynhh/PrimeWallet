package com.sonnhuynhh.primewallet.payment.service;

import com.sonnhuynhh.primewallet.payment.config.VnpayConfig;
import com.sonnhuynhh.primewallet.payment.dto.PaymentRequest;
import com.sonnhuynhh.primewallet.payment.dto.PaymentResponse;
import com.sonnhuynhh.primewallet.payment.util.VnpayUtil;
import com.sonnhuynhh.primewallet.wallet.dto.TopUpRequest;
import com.sonnhuynhh.primewallet.wallet.service.TransactionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private final VnpayConfig vnpayConfig;
    private final TransactionService transactionService;

    /**
     * Tạo URL thanh toán VNPAY.
     * VNPAY yêu cầu rất nhiều tham số (Amount, TmnCode, ReturnUrl, v.v.),
     * sau đó sắp xếp theo bảng chữ cái và tạo mã băm HMAC-SHA512 để bảo vệ dữ liệu.
     *
     * @param request Chứa số tiền cần nạp
     * @param clientIp IP của người dùng thực hiện giao dịch (chống gian lận)
     * @return PaymentResponse chứa URL để redirect user sang VNPAY
     */
    public PaymentResponse createPayment(PaymentRequest request, String clientIp, UUID userId) {
        // 1. Tạo các tham số bắt buộc theo tài liệu VNPAY
        String vnp_Version = VnpayConfig.VNP_VERSION;
        String vnp_Command = VnpayConfig.VNP_COMMAND;
        String orderType = "other"; // Loại hàng hóa (other = thanh toán hóa đơn/nạp tiền)
        
        // VNPAY tính số tiền bằng đơn vị VNĐ * 100
        // Ví dụ: 100,000 VNĐ -> "10000000"
        long amount = request.getAmount().longValue() * 100;
        
        // TxnRef là mã giao dịch duy nhất tại hệ thống của chúng ta.
        // Dùng UUID để map thẳng vào idempotencyKey của Transaction.
        String vnp_TxnRef = UUID.randomUUID().toString();
        String vnp_IpAddr = clientIp;

        Map<String, String> vnp_Params = new HashMap<>();
        vnp_Params.put("vnp_Version", vnp_Version);
        vnp_Params.put("vnp_Command", vnp_Command);
        vnp_Params.put("vnp_TmnCode", vnpayConfig.getTmnCode());
        vnp_Params.put("vnp_Amount", String.valueOf(amount));
        vnp_Params.put("vnp_CurrCode", VnpayConfig.VNP_CURRENCY);
        vnp_Params.put("vnp_TxnRef", vnp_TxnRef);
        vnp_Params.put("vnp_OrderInfo", "TOPUP:" + userId.toString() + ":" + vnp_TxnRef);
        vnp_Params.put("vnp_OrderType", orderType);
        vnp_Params.put("vnp_Locale", VnpayConfig.VNP_LOCALE);
        vnp_Params.put("vnp_ReturnUrl", vnpayConfig.getVnpayReturnUrl());
        vnp_Params.put("vnp_IpAddr", vnp_IpAddr);

        // 2. Tạo ngày giờ (Create Date & Expire Date) theo format yyyyMMddHHmmss
        Calendar cld = Calendar.getInstance(TimeZone.getTimeZone("Etc/GMT+7"));
        SimpleDateFormat formatter = new SimpleDateFormat("yyyyMMddHHmmss");
        String vnp_CreateDate = formatter.format(cld.getTime());
        vnp_Params.put("vnp_CreateDate", vnp_CreateDate);
        
        // Đặt thời gian hết hạn của link thanh toán là 15 phút
        cld.add(Calendar.MINUTE, 15);
        String vnp_ExpireDate = formatter.format(cld.getTime());
        vnp_Params.put("vnp_ExpireDate", vnp_ExpireDate);

        // 3. Sắp xếp các tham số theo bảng chữ cái (bắt buộc bởi VNPAY)
        List<String> fieldNames = new ArrayList<>(vnp_Params.keySet());
        Collections.sort(fieldNames);

        // 4. Nối các tham số thành chuỗi query (hash data)
        StringBuilder hashData = new StringBuilder();
        StringBuilder query = new StringBuilder();
        Iterator<String> itr = fieldNames.iterator();
        while (itr.hasNext()) {
            String fieldName = itr.next();
            String fieldValue = vnp_Params.get(fieldName);
            if ((fieldValue != null) && (fieldValue.length() > 0)) {
                // Build hash data
                hashData.append(fieldName);
                hashData.append('=');
                hashData.append(URLEncoder.encode(fieldValue, StandardCharsets.US_ASCII));
                
                // Build query
                query.append(URLEncoder.encode(fieldName, StandardCharsets.US_ASCII));
                query.append('=');
                query.append(URLEncoder.encode(fieldValue, StandardCharsets.US_ASCII));
                if (itr.hasNext()) {
                    query.append('&');
                    hashData.append('&');
                }
            }
        }
        
        String queryUrl = query.toString();
        
        // 5. Tạo mã bảo mật (Secure Hash) bằng HMAC-SHA512
        String vnp_SecureHash = VnpayUtil.hmacSHA512(vnpayConfig.getSecretKey(), hashData.toString());
        queryUrl += "&vnp_SecureHash=" + vnp_SecureHash;
        
        // 6. Hoàn thiện URL thanh toán
        String paymentUrl = vnpayConfig.getVnpayUrl() + "?" + queryUrl;
        
        log.info("Tạo thành công URL thanh toán VNPAY, TxnRef: {}, Amount: {}", vnp_TxnRef, request.getAmount());

        return PaymentResponse.builder()
                .paymentUrl(paymentUrl)
                .txnRef(vnp_TxnRef)
                .build();
    }

    /**
     * Xử lý Webhook (IPN) từ VNPAY.
     * @param params Tất cả tham số VNPAY gửi về
     * @return Chuỗi phản hồi theo chuẩn VNPAY để họ biết mình đã nhận
     */
    public String processIpn(Map<String, String> params) {
        try {
            log.info("Nhận IPN từ VNPAY: {}", params);
            String vnp_SecureHash = params.get("vnp_SecureHash");
            
            // Remove hash params before calculating signature
            Map<String, String> fields = new HashMap<>(params);
            fields.remove("vnp_SecureHashType");
            fields.remove("vnp_SecureHash");

            // Verify signature
            String signValue = VnpayUtil.hashAllFields(fields, vnpayConfig.getSecretKey());
            if (!signValue.equals(vnp_SecureHash)) {
                log.error("Sai chữ ký IPN từ VNPAY!");
                // Theo tài liệu VNPAY: 97 = Checksum failed
                return "{\"RspCode\":\"97\",\"Message\":\"Checksum failed\"}";
            }

            String vnp_ResponseCode = params.get("vnp_ResponseCode");
            String vnp_OrderInfo = params.get("vnp_OrderInfo");
            String vnp_TxnRef = params.get("vnp_TxnRef");
            String vnp_AmountStr = params.get("vnp_Amount");

            // Chỉ xử lý nếu giao dịch thành công (00 = Success)
            if ("00".equals(vnp_ResponseCode)) {
                // vnp_OrderInfo có định dạng "TOPUP:{userId}:{txnRef}"
                String[] parts = vnp_OrderInfo.split(":");
                if (parts.length >= 2 && "TOPUP".equals(parts[0])) {
                    UUID userId = UUID.fromString(parts[1]);
                    // VNPAY amount phải chia 100
                    java.math.BigDecimal amount = new java.math.BigDecimal(vnp_AmountStr).divide(new java.math.BigDecimal(100));

                    TopUpRequest topUpRequest = new TopUpRequest();
                    topUpRequest.setAmount(amount);
                    topUpRequest.setIdempotencyKey(UUID.fromString(vnp_TxnRef)); // Ép kiểu UUID
                    topUpRequest.setDescription("Nạp tiền từ VNPAY - TxnRef: " + vnp_TxnRef);

                    // Gọi sang module Ví để nạp tiền (có Transactional)
                    try {
                        transactionService.topUp(topUpRequest, userId);
                        log.info("Đã nạp thành công {} VNĐ cho user {} từ IPN", amount, userId);
                        // Theo tài liệu VNPAY: 00 = Confirm Success
                        return "{\"RspCode\":\"00\",\"Message\":\"Confirm Success\"}";
                    } catch (com.sonnhuynhh.primewallet.common.exception.AccountLockedException | com.sonnhuynhh.primewallet.common.exception.KycRequiredException e) {
                        log.error("Lỗi nghiệp vụ khi IPN nạp tiền: {}", e.getMessage());
                        // Có thể ghi vào DB để Admin xử lý tay sau. Ở đây tạm thời trả về lỗi.
                        // Trả về 00 để VNPAY ko gọi lại nữa, nhưng bản thân giao dịch thất bại
                        return "{\"RspCode\":\"00\",\"Message\":\"Confirm Success - Handled with internal error\"}";
                    } catch (Exception e) {
                        log.error("Lỗi không xác định khi IPN nạp tiền", e);
                        // Trả về 99 để VNPAY có thể thử gọi lại sau
                        return "{\"RspCode\":\"99\",\"Message\":\"Unknown error\"}";
                    }
                }
            } else {
                log.info("Giao dịch IPN bị hủy hoặc thất bại. Mã: {}", vnp_ResponseCode);
            }

            return "{\"RspCode\":\"00\",\"Message\":\"Confirm Success\"}";
        } catch (Exception e) {
            log.error("Lỗi khi xử lý IPN VNPAY", e);
            return "{\"RspCode\":\"99\",\"Message\":\"Unknown error\"}";
        }
    }
}
