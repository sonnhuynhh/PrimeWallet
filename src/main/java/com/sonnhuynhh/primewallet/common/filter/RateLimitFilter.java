package com.sonnhuynhh.primewallet.common.filter;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Duration;

/**
 * Interceptor giới hạn số request (Rate Limiting) bằng Redis.
 *
 * Tại sao cần Rate Limiting trong ứng dụng tài chính?
 * 1. Chống DDoS: Kẻ tấn công gửi hàng ngàn request/giây để làm sập server.
 * 2. Chống Brute-force: Thử hàng ngàn mật khẩu để đăng nhập trái phép.
 * 3. Chống Spam: User hoặc bot gọi API nạp/chuyển tiền liên tục.
 *
 * Cách hoạt động (Sliding Window Counter):
 * - Mỗi request đến → lấy IP address làm key
 * - Tăng counter trong Redis: "rate_limit:{IP}" += 1
 * - Nếu counter > giới hạn → trả HTTP 429 (Too Many Requests)
 * - Key tự hết hạn sau 1 phút (TTL) → counter reset
 *
 * Tại sao dùng HandlerInterceptor thay vì Servlet Filter?
 * → HandlerInterceptor chạy SAU Spring Security Filter Chain
 *   → Có thể truy cập thông tin user đã xác thực
 * → Servlet Filter chạy TRƯỚC Spring Security → không biết user là ai
 * → Tuy nhiên ở đây ta dùng IP nên cả 2 đều được,
 *   nhưng Interceptor dễ tích hợp vào Spring MVC hơn.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RateLimitFilter implements HandlerInterceptor {

    private final RedisTemplate<String, String> redisTemplate;

    /**
     * Giới hạn request/phút cho API thường.
     * Đọc từ application.properties, mặc định 60 nếu không cấu hình.
     */
    @Value("${rate-limit.requests-per-minute:60}")
    private int requestsPerMinute;

    /**
     * Giới hạn request/phút cho API đăng nhập (nghiêm ngặt hơn).
     * Mặc định 5 lần/phút để chống brute-force.
     */
    @Value("${rate-limit.login-requests-per-minute:5}")
    private int loginRequestsPerMinute;

    /**
     * preHandle() chạy TRƯỚC khi request đến Controller.
     * Trả về true = cho phép request đi tiếp.
     * Trả về false = chặn request (đã trả response 429).
     */
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String clientIp = getClientIp(request);
        String requestUri = request.getRequestURI();

        // Xác định giới hạn dựa trên endpoint
        // API login cần giới hạn CHẶT hơn (5 req/phút) để chống brute-force
        int limit = requestUri.contains("/auth/login") ? loginRequestsPerMinute : requestsPerMinute;

        // Tạo Redis key: "rate_limit:{IP}:{endpoint_type}"
        String keyType = requestUri.contains("/auth/login") ? "login" : "general";
        String redisKey = String.format("rate_limit:%s:%s", clientIp, keyType);

        // Tăng counter trong Redis
        // increment() trả về giá trị SAU KHI tăng (1, 2, 3, ...)
        Long currentCount = redisTemplate.opsForValue().increment(redisKey);

        if (currentCount != null) {
            // Nếu đây là request ĐẦU TIÊN (counter = 1) → đặt TTL = 1 phút
            // TTL (Time To Live) = sau 1 phút, key tự xoá → counter reset về 0
            if (currentCount == 1) {
                redisTemplate.expire(redisKey, Duration.ofMinutes(1));
            }

            // Nếu vượt giới hạn → trả 429
            if (currentCount > limit) {
                log.warn("⚠️ Rate limit exceeded: IP={}, endpoint={}, count={}/{}",
                        clientIp, requestUri, currentCount, limit);

                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.setCharacterEncoding("UTF-8");

                // Viết JSON response trực tiếp (không cần ObjectMapper)
                String errorJson = String.format(
                        "{\"success\":false,\"message\":\"Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút. (Giới hạn: %d request/phút)\",\"data\":null}",
                        limit);
                response.getWriter().write(errorJson);
                return false; // CHẶN request — không cho đi tiếp đến Controller
            }
        }

        return true; // CHO PHÉP request đi tiếp
    }

    /**
     * Lấy IP thật của client.
     *
     * Tại sao cần kiểm tra header X-Forwarded-For?
     * → Khi app chạy sau reverse proxy (Nginx, CloudFlare, Load Balancer),
     *   request.getRemoteAddr() trả về IP của proxy (127.0.0.1), không phải IP thật.
     * → Proxy sẽ ghi IP thật của client vào header "X-Forwarded-For".
     * → Nếu không có header này → fallback về getRemoteAddr() (chạy trực tiếp).
     */
    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            // X-Forwarded-For có thể chứa nhiều IP (qua nhiều proxy)
            // IP đầu tiên là IP thật của client
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
