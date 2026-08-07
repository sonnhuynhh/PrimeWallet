package com.sonnhuynhh.primewallet.config;

import com.sonnhuynhh.primewallet.common.filter.RateLimitFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Cấu hình Web MVC — Đăng ký các Interceptor và CORS.
 *
 * WebMvcConfigurer là interface cho phép ta tùy chỉnh hành vi của Spring MVC.
 * Ở đây ta dùng nó để:
 *   1. Đăng ký RateLimitFilter (chống DDoS/brute-force)
 *   2. Cấu hình CORS (Fix #13) — cho phép mobile app / web client gọi API
 *
 * addPathPatterns("/api/**"):
 * → Chỉ áp dụng cho các API endpoint.
 * → Không áp dụng cho static resources (CSS, JS, hình ảnh)
 *   hoặc các endpoint hệ thống (health check, actuator).
 */
@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final RateLimitFilter rateLimitFilter;

    /**
     * Fix #13: Danh sách origin được phép, đọc từ application.properties
     * (cors.allowed-origins). Dev dùng localhost, prod đặt domain thật.
     */
    @Value("${cors.allowed-origins:http://localhost:19006,http://localhost:8081}")
    private String[] allowedOrigins;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(rateLimitFilter)
                .addPathPatterns("/api/**"); // Chỉ áp dụng cho API endpoints
    }

    /**
     * Fix #13: CORS configuration cho mobile app và web client.
     *
     * Chỉ cho phép các origin cụ thể (không dùng "*") vì allowCredentials(true)
     * yêu cầu origin phải tường minh — đây cũng là thực hành bảo mật đúng.
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
