package com.sonnhuynhh.primewallet.config;

import com.sonnhuynhh.primewallet.common.filter.RateLimitFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Cấu hình Web MVC — Đăng ký các Interceptor.
 *
 * WebMvcConfigurer là interface cho phép ta tùy chỉnh hành vi của Spring MVC.
 * Ở đây ta chỉ dùng nó để đăng ký RateLimitFilter.
 *
 * addPathPatterns("/api/**"):
 * → Chỉ áp dụng rate limit cho các API endpoint.
 * → Không áp dụng cho static resources (CSS, JS, hình ảnh)
 *   hoặc các endpoint hệ thống (health check, actuator).
 */
@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final RateLimitFilter rateLimitFilter;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(rateLimitFilter)
                .addPathPatterns("/api/**"); // Chỉ áp dụng cho API endpoints
    }
}
