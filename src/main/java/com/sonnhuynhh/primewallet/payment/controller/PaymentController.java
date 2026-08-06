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
        boolean isSuccess = "00".equals(vnp_ResponseCode);
        
        String title = isSuccess ? "Thanh toán thành công!" : "Giao dịch thất bại";
        String message = isSuccess ? "Tiền đã được nạp vào ví của bạn. Vui lòng đóng trang này để quay lại ứng dụng." 
                                   : "Giao dịch thất bại hoặc bị hủy. Mã lỗi: " + vnp_ResponseCode;
        String colorClass = isSuccess ? "text-emerald-400" : "text-red-400";
        String bgClass = isSuccess ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30";
        String icon = isSuccess ? "✓" : "✗";

        String html = """
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Kết quả thanh toán VNPAY</title>
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body class="bg-slate-950 text-slate-200 min-h-screen flex items-center justify-center p-4 font-sans">
                <div class="max-w-md w-full %s border rounded-2xl p-8 text-center shadow-2xl backdrop-blur-sm">
                    <div class="w-20 h-20 mx-auto rounded-full %s border-4 border-current flex items-center justify-center text-4xl font-bold mb-6">
                        %s
                    </div>
                    <h1 class="text-2xl font-black text-white mb-2">%s</h1>
                    <p class="text-slate-400 mb-8 leading-relaxed">%s</p>
                    <button onclick="window.close()" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-colors border border-slate-700">
                        Đóng cửa sổ và Quay lại ví
                    </button>
                    <script>
                        // Thử đóng tự động sau 5 giây nếu trình duyệt cho phép
                        setTimeout(() => {
                            window.close();
                        }, 5000);
                    </script>
                </div>
            </body>
            </html>
        """.formatted(bgClass, colorClass, icon, title, message);

        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.add("Content-Type", "text/html; charset=UTF-8");
        
        return new ResponseEntity<>(html, headers, org.springframework.http.HttpStatus.OK);
    }
}
