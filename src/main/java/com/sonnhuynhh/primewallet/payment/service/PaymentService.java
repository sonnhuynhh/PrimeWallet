package com.sonnhuynhh.primewallet.payment.service;

import com.sonnhuynhh.primewallet.payment.config.VnpayConfig;
import com.sonnhuynhh.primewallet.payment.dto.PaymentConfirmResult;
import com.sonnhuynhh.primewallet.payment.dto.PaymentRequest;
import com.sonnhuynhh.primewallet.payment.dto.PaymentResponse;
import com.sonnhuynhh.primewallet.payment.entity.PaymentOrder;
import com.sonnhuynhh.primewallet.payment.enums.PaymentOrderStatus;
import com.sonnhuynhh.primewallet.payment.repository.PaymentOrderRepository;
import com.sonnhuynhh.primewallet.payment.util.VnpayUtil;
import com.sonnhuynhh.primewallet.wallet.dto.TopUpRequest;
import com.sonnhuynhh.primewallet.wallet.service.TransactionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
    private final PaymentOrderRepository paymentOrderRepository;

    /** VNPAY tính số tiền theo đơn vị "xu" = VNĐ * 100. */
    private static final BigDecimal VNP_AMOUNT_MULTIPLIER = new BigDecimal("100");

    /**
     * Tạo URL thanh toán VNPAY.
     * VNPAY yêu cầu rất nhiều tham số (Amount, TmnCode, ReturnUrl, v.v.),
     * sau đó sắp xếp theo bảng chữ cái và tạo mã băm HMAC-SHA512 để bảo vệ dữ liệu.
     *
     * QUAN TRỌNG (Fix #16): Trước khi trả URL, ta LƯU 1 PaymentOrder (PENDING) với
     * userId + số tiền kỳ vọng. Khi IPN trả về, ta đối chiếu với đơn này thay vì
     * tin tưởng mù quáng dữ liệu callback.
     *
     * @param request Chứa số tiền cần nạp
     * @param clientIp IP của người dùng thực hiện giao dịch (chống gian lận)
     * @return PaymentResponse chứa URL để redirect user sang VNPAY
     */
    @Transactional
    public PaymentResponse createPayment(PaymentRequest request, String clientIp, UUID userId) {
        // 1. Tạo các tham số bắt buộc theo tài liệu VNPAY
        String vnp_Version = VnpayConfig.VNP_VERSION;
        String vnp_Command = VnpayConfig.VNP_COMMAND;
        String orderType = "other"; // Loại hàng hóa (other = thanh toán hóa đơn/nạp tiền)

        // VNPAY tính số tiền bằng đơn vị VNĐ * 100. Ví dụ: 100,000 VNĐ -> "10000000".
        // Fix #6: dùng BigDecimal.multiply (không longValue()*100) để không mất phần thập phân,
        // và longValueExact() để phát hiện tràn/thập phân bất thường thay vì âm thầm cắt.
        long amount = request.getAmount().multiply(VNP_AMOUNT_MULTIPLIER).longValueExact();

        // TxnRef là mã giao dịch duy nhất tại hệ thống của chúng ta.
        // Dùng UUID để map thẳng vào idempotencyKey của Transaction.
        String vnp_TxnRef = UUID.randomUUID().toString();
        String vnp_IpAddr = clientIp;

        // 2. LƯU ĐƠN THANH TOÁN (PENDING) — nguồn tin cậy để đối soát IPN sau này
        PaymentOrder order = PaymentOrder.builder()
                .txnRef(vnp_TxnRef)
                .userId(userId)
                .amount(request.getAmount())
                .status(PaymentOrderStatus.PENDING)
                .build();
        paymentOrderRepository.save(order);

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

        // 3. Tạo ngày giờ (Create Date & Expire Date) theo format yyyyMMddHHmmss
        Calendar cld = Calendar.getInstance(TimeZone.getTimeZone("Etc/GMT+7"));
        SimpleDateFormat formatter = new SimpleDateFormat("yyyyMMddHHmmss");
        String vnp_CreateDate = formatter.format(cld.getTime());
        vnp_Params.put("vnp_CreateDate", vnp_CreateDate);

        // Đặt thời gian hết hạn của link thanh toán là 15 phút
        cld.add(Calendar.MINUTE, 15);
        String vnp_ExpireDate = formatter.format(cld.getTime());
        vnp_Params.put("vnp_ExpireDate", vnp_ExpireDate);

        // 4. Sắp xếp các tham số theo bảng chữ cái (bắt buộc bởi VNPAY)
        List<String> fieldNames = new ArrayList<>(vnp_Params.keySet());
        Collections.sort(fieldNames);

        // 5. Nối các tham số thành chuỗi query (hash data)
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

        // 6. Tạo mã bảo mật (Secure Hash) bằng HMAC-SHA512
        String vnp_SecureHash = VnpayUtil.hmacSHA512(vnpayConfig.getSecretKey(), hashData.toString());
        queryUrl += "&vnp_SecureHash=" + vnp_SecureHash;

        // 7. Hoàn thiện URL thanh toán
        String paymentUrl = vnpayConfig.getVnpayUrl() + "?" + queryUrl;

        log.info("Tạo thành công URL thanh toán VNPAY, TxnRef: {}, Amount: {}", vnp_TxnRef, request.getAmount());

        return PaymentResponse.builder()
                .paymentUrl(paymentUrl)
                .txnRef(vnp_TxnRef)
                .build();
    }

    /**
     * Xử lý Webhook (IPN) từ VNPAY.
     *
     * Fix #3 + #16: Đối chiếu với PaymentOrder đã lưu, lấy userId TỪ ĐƠN (không tin
     * callback), đối chiếu số tiền, và LƯU LẠI trạng thái FAILED nếu nghiệp vụ nạp
     * tiền thất bại (thay vì âm thầm nuốt lỗi làm mất tiền).
     *
     * @param params Tất cả tham số VNPAY gửi về
     * @return Chuỗi phản hồi theo chuẩn VNPAY để họ biết mình đã nhận
     */
    public String processIpn(Map<String, String> params) {
        try {
            log.info("Nhận IPN từ VNPAY: {}", params);

            if (!isValidSignature(params)) {
                log.error("Sai chữ ký IPN từ VNPAY!");
                return ipnResponse("97", "Checksum failed");
            }

            SettlementResult result = settlePaymentOrder(params, null);
            return switch (result) {
                case SettlementResult.AlreadyDone ignored -> ipnResponse("02", "Order already confirmed");
                case SettlementResult.OrderNotFound ignored -> ipnResponse("01", "Order not found");
                case SettlementResult.InvalidAmount ignored -> ipnResponse("04", "Invalid amount");
                case SettlementResult.Cancelled ignored -> ipnResponse("00", "Confirm Success");
                case SettlementResult.Credited ignored -> ipnResponse("00", "Confirm Success");
                case SettlementResult.BusinessError ignored -> ipnResponse("00", "Confirm Success");
                case SettlementResult.Forbidden ignored -> ipnResponse("01", "Order not found");
            };
        } catch (Exception e) {
            log.error("Lỗi không xác định khi xử lý IPN VNPAY", e);
            return ipnResponse("99", "Unknown error");
        }
    }

    /**
     * Xác nhận thanh toán từ Return URL (frontend gọi sau khi VNPAY redirect).
     *
     * Dùng khi chạy local: VNPAY không gọi được IPN tới localhost. Vẫn an toàn vì:
     * - Chữ ký HMAC phải hợp lệ (do VNPAY ký)
     * - JWT xác thực user
     * - userId phải khớp đơn thanh toán
     * - Idempotent qua PaymentOrder (không cộng trùng)
     */
    @Transactional
    public PaymentConfirmResult confirmFromReturn(Map<String, String> params, UUID callerUserId) {
        if (!isValidSignature(params)) {
            log.warn("Confirm return: chữ ký không hợp lệ");
            return PaymentConfirmResult.builder()
                    .credited(false)
                    .alreadyProcessed(false)
                    .message("Chữ ký không hợp lệ. Vui lòng liên hệ hỗ trợ nếu đã bị trừ tiền.")
                    .build();
        }

        String vnp_ResponseCode = params.get("vnp_ResponseCode");
        if (!"00".equals(vnp_ResponseCode)) {
            return PaymentConfirmResult.builder()
                    .credited(false)
                    .alreadyProcessed(false)
                    .message("Giao dịch thất bại hoặc đã bị hủy.")
                    .build();
        }

        SettlementResult result = settlePaymentOrder(params, callerUserId);
        return switch (result) {
            case SettlementResult.Credited c -> PaymentConfirmResult.builder()
                    .credited(true)
                    .alreadyProcessed(false)
                    .message("Nạp thành công " + c.amount() + " VNĐ vào ví.")
                    .build();
            case SettlementResult.AlreadyDone ignored -> PaymentConfirmResult.builder()
                    .credited(false)
                    .alreadyProcessed(true)
                    .message("Giao dịch đã được xử lý trước đó.")
                    .build();
            case SettlementResult.OrderNotFound ignored -> PaymentConfirmResult.builder()
                    .credited(false)
                    .alreadyProcessed(false)
                    .message("Không tìm thấy đơn thanh toán.")
                    .build();
            case SettlementResult.Forbidden ignored -> PaymentConfirmResult.builder()
                    .credited(false)
                    .alreadyProcessed(false)
                    .message("Bạn không có quyền xác nhận giao dịch này.")
                    .build();
            case SettlementResult.InvalidAmount ignored -> PaymentConfirmResult.builder()
                    .credited(false)
                    .alreadyProcessed(false)
                    .message("Số tiền không khớp với đơn thanh toán.")
                    .build();
            case SettlementResult.Cancelled ignored -> PaymentConfirmResult.builder()
                    .credited(false)
                    .alreadyProcessed(false)
                    .message("Giao dịch đã bị hủy.")
                    .build();
            case SettlementResult.BusinessError e -> PaymentConfirmResult.builder()
                    .credited(false)
                    .alreadyProcessed(false)
                    .message("Không nạp được vào ví: " + e.reason() + ". Vui lòng liên hệ hỗ trợ.")
                    .build();
        };
    }

    /**
     * Logic cộng tiền dùng chung cho IPN và confirm return.
     *
     * @param callerUserId null khi gọi từ IPN (server-to-server); bắt buộc khớp đơn khi gọi từ frontend.
     */
    private SettlementResult settlePaymentOrder(Map<String, String> params, UUID callerUserId) {
        String vnp_ResponseCode = params.get("vnp_ResponseCode");
        String vnp_TxnRef = params.get("vnp_TxnRef");
        String vnp_AmountStr = params.get("vnp_Amount");

        if (vnp_TxnRef == null) {
            log.error("Thiếu vnp_TxnRef");
            return new SettlementResult.OrderNotFound();
        }

        Optional<PaymentOrder> orderOpt = paymentOrderRepository.findByTxnRef(vnp_TxnRef);
        if (orderOpt.isEmpty()) {
            log.error("Không tìm thấy đơn thanh toán với TxnRef: {}", vnp_TxnRef);
            return new SettlementResult.OrderNotFound();
        }
        PaymentOrder order = orderOpt.get();

        if (callerUserId != null && !order.getUserId().equals(callerUserId)) {
            log.warn("User {} cố xác nhận đơn của user {}", callerUserId, order.getUserId());
            return new SettlementResult.Forbidden();
        }

        if (order.getStatus() == PaymentOrderStatus.SUCCESS) {
            log.info("Đơn {} đã được xử lý thành công trước đó (idempotent).", vnp_TxnRef);
            return new SettlementResult.AlreadyDone();
        }

        BigDecimal expectedVnpAmount = order.getAmount().multiply(VNP_AMOUNT_MULTIPLIER);
        BigDecimal actualVnpAmount;
        try {
            actualVnpAmount = new BigDecimal(vnp_AmountStr);
        } catch (Exception e) {
            log.error("vnp_Amount không hợp lệ: {}", vnp_AmountStr);
            return new SettlementResult.InvalidAmount();
        }
        if (expectedVnpAmount.compareTo(actualVnpAmount) != 0) {
            log.error("Số tiền callback không khớp. Kỳ vọng: {}, nhận: {}", expectedVnpAmount, actualVnpAmount);
            markFailed(order, vnp_ResponseCode,
                    "Số tiền không khớp: kỳ vọng " + expectedVnpAmount + ", nhận " + actualVnpAmount);
            return new SettlementResult.InvalidAmount();
        }

        if (!"00".equals(vnp_ResponseCode)) {
            log.info("Giao dịch bị hủy hoặc thất bại. Mã: {}", vnp_ResponseCode);
            order.setStatus(PaymentOrderStatus.CANCELLED);
            order.setVnpResponseCode(vnp_ResponseCode);
            paymentOrderRepository.save(order);
            return new SettlementResult.Cancelled();
        }

        TopUpRequest topUpRequest = new TopUpRequest();
        topUpRequest.setAmount(order.getAmount());
        topUpRequest.setIdempotencyKey(UUID.fromString(vnp_TxnRef));
        topUpRequest.setDescription("Nạp tiền từ VNPAY - TxnRef: " + vnp_TxnRef);

        try {
            transactionService.topUp(topUpRequest, order.getUserId());
            order.setStatus(PaymentOrderStatus.SUCCESS);
            order.setVnpResponseCode(vnp_ResponseCode);
            paymentOrderRepository.save(order);
            log.info("Đã nạp thành công {} VNĐ cho user {} (TxnRef: {})",
                    order.getAmount(), order.getUserId(), vnp_TxnRef);
            return new SettlementResult.Credited(order.getAmount());
        } catch (com.sonnhuynhh.primewallet.common.exception.AccountLockedException
                 | com.sonnhuynhh.primewallet.common.exception.KycRequiredException e) {
            log.error("Lỗi nghiệp vụ khi nạp tiền (cần đối soát tay): {}", e.getMessage());
            markFailed(order, vnp_ResponseCode, "Nạp ví thất bại: " + e.getMessage());
            return new SettlementResult.BusinessError(e.getMessage());
        }
    }

    /** Kết quả nội bộ của settlePaymentOrder. */
    private sealed interface SettlementResult {
        record AlreadyDone() implements SettlementResult {}
        record OrderNotFound() implements SettlementResult {}
        record Forbidden() implements SettlementResult {}
        record InvalidAmount() implements SettlementResult {}
        record Cancelled() implements SettlementResult {}
        record Credited(BigDecimal amount) implements SettlementResult {}
        record BusinessError(String reason) implements SettlementResult {}
    }

    /**
     * Kiểm tra chữ ký VNPAY (HMAC-SHA512) trên toàn bộ tham số callback.
     * Dùng chung cho cả IPN và Return URL.
     */
    public boolean isValidSignature(Map<String, String> params) {
        String vnp_SecureHash = params.get("vnp_SecureHash");
        if (vnp_SecureHash == null || vnp_SecureHash.isEmpty()) {
            return false;
        }
        Map<String, String> fields = new HashMap<>(params);
        fields.remove("vnp_SecureHashType");
        fields.remove("vnp_SecureHash");
        String signValue = VnpayUtil.hashAllFields(fields, vnpayConfig.getSecretKey());
        return signValue != null && !signValue.isEmpty() && signValue.equals(vnp_SecureHash);
    }

    /**
     * Xử lý Return URL (trình duyệt người dùng quay về sau thanh toán).
     *
     * Fix #4: Endpoint này CHỈ HIỂN THỊ trạng thái, KHÔNG thay đổi số dư.
     * Việc cộng tiền chỉ được thực hiện qua webhook server-to-server /ipn (đã ký & idempotent).
     * Trả về thông điệp thân thiện, không tiết lộ chi tiết nội bộ.
     *
     * @return chuỗi thông báo cho người dùng
     */
    public String handleReturnDisplay(Map<String, String> params) {
        if (!isValidSignature(params)) {
            log.warn("Return URL có chữ ký không hợp lệ.");
            return "Chữ ký không hợp lệ. Vui lòng quay lại ứng dụng và kiểm tra lịch sử giao dịch.";
        }
        String vnp_ResponseCode = params.get("vnp_ResponseCode");
        if ("00".equals(vnp_ResponseCode)) {
            return "Thanh toán thành công! Tiền sẽ được nạp vào ví trong giây lát. "
                    + "Vui lòng quay lại ứng dụng và kiểm tra số dư.";
        }
        return "Giao dịch thất bại hoặc đã bị hủy. Vui lòng quay lại ứng dụng và thử lại.";
    }

    /**
     * Đánh dấu đơn thất bại và lưu lý do (giao dịch riêng để không bị rollback chung).
     */
    private void markFailed(PaymentOrder order, String responseCode, String reason) {
        order.setStatus(PaymentOrderStatus.FAILED);
        order.setVnpResponseCode(responseCode);
        order.setFailureReason(reason);
        paymentOrderRepository.save(order);
    }

    /** Tạo chuỗi JSON phản hồi chuẩn VNPAY. */
    private String ipnResponse(String code, String message) {
        return String.format("{\"RspCode\":\"%s\",\"Message\":\"%s\"}", code, message);
    }
}
