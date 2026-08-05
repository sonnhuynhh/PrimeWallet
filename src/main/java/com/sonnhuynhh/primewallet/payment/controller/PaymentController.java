package com.sonnhuynhh.primewallet.payment.controller;

import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.common.dto.ApiResponse;
import com.sonnhuynhh.primewallet.payment.dto.PaymentRequest;
import com.sonnhuynhh.primewallet.payment.dto.PaymentResponse;
import com.sonnhuynhh.primewallet.payment.service.PaymentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/payment/vnpay")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final UserRepository userRepository;

    /**
     * API tạo URL thanh toán VNPAY.
     * Người dùng (App/Web) gọi API này truyền số tiền muốn nạp.
     * Server trả về một URL của VNPAY.
     * Người dùng chuyển hướng (redirect) đến URL này để nhập thông tin thẻ.
     */
    @PostMapping("/create")
    public ResponseEntity<ApiResponse<PaymentResponse>> createPayment(
            @Valid @RequestBody PaymentRequest request,
            HttpServletRequest httpServletRequest,
            Authentication authentication) {
        
        // Lấy thông tin user từ email trong token
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException("User not found"));
        java.util.UUID userId = user.getId();

        // Lấy IP của người dùng để gửi sang VNPAY (chống gian lận)
        String clientIp = getClientIp(httpServletRequest);
        
        PaymentResponse response = paymentService.createPayment(request, clientIp, userId);
        
        return ResponseEntity.ok(ApiResponse.success("Tạo URL thanh toán thành công", response));
    }

    /**
     * Hàm phụ trợ để lấy IP thật của client đằng sau Proxy/Load Balancer.
     */
    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    /**
     * API Webhook (IPN - Instant Payment Notification)
     * VNPAY sẽ gọi API này ở backend để thông báo kết quả giao dịch.
     * Lưu ý: API này không yêu cầu JWT Token (public) vì VNPAY không có token của chúng ta.
     * Bảo mật được đảm bảo bằng vnp_SecureHash.
     */
    @GetMapping("/ipn")
    public ResponseEntity<String> vnpayIpn(@RequestParam Map<String, String> params) {
        String response = paymentService.processIpn(params);
        return ResponseEntity.ok(response);
    }

    /**
     * API Return URL
     * VNPAY sẽ chuyển hướng trình duyệt của người dùng về đây sau khi thanh toán xong.
     * Để tiện test ở localhost (không có Ngrok), ta cho Return URL xử lý luôn giao dịch như IPN.
     */
    @GetMapping("/return")
    public ResponseEntity<String> vnpayReturn(@RequestParam Map<String, String> params) {
        // Xử lý giao dịch
        paymentService.processIpn(params);
        
        String vnp_ResponseCode = params.get("vnp_ResponseCode");
        if ("00".equals(vnp_ResponseCode)) {
            return ResponseEntity.ok("Thanh toán thành công! Tiền đã được nạp vào ví của bạn. Vui lòng quay lại ứng dụng.");
        } else {
            return ResponseEntity.badRequest().body("Giao dịch thất bại hoặc bị hủy. Mã lỗi: " + vnp_ResponseCode);
        }
    }
}
