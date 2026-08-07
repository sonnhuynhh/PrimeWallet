package com.sonnhuynhh.primewallet.config;

import com.sonnhuynhh.primewallet.auth.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

/**
 * Cấu hình bảo mật cho toàn bộ ứng dụng.
 *
 * Nguyên tắc:
 * 1. API công khai (đăng ký, đăng nhập, refresh): Ai cũng truy cập được
 * 2. API riêng tư: Phải có JWT token hợp lệ
 * 3. API admin: Phải có role ADMIN
 * 4. Stateless: Không dùng session, mỗi request tự xác thực bằng JWT
 *
 * @EnableMethodSecurity: Cho phép dùng @PreAuthorize trên method/controller
 * để kiểm soát quyền truy cập chi tiết hơn.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final UserDetailsService userDetailsService;

    @Value("${cors.allowed-origins:http://localhost:19006,http://localhost:8081}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // 1. Tắt CSRF vì ta dùng JWT (stateless), không dùng cookie
                .csrf(csrf -> csrf.disable())

                // 2. Bật CORS với cấu hình tùy chỉnh (Fix #13)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                // 2. Cấu hình quyền truy cập API
                .authorizeHttpRequests(auth -> auth
                        // API công khai — Ai cũng truy cập được
                        // CHỈ cho phép 3 endpoint cụ thể (register, login, refresh)
                        // KHÔNG dùng /auth/** nữa vì /auth/profile cần bảo vệ!
                        .requestMatchers(
                                "/api/v1/auth/register",
                                "/api/v1/auth/login",
                                "/api/v1/auth/refresh",
                                "/api/payment/vnpay/ipn",
                                "/api/payment/vnpay/return"
                        ).permitAll()

                        // API dành riêng cho ADMIN
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")

                        // Tất cả API còn lại (bao gồm /auth/profile) — Phải đăng nhập (có JWT)
                        .anyRequest().authenticated()
                )

                // 3. Stateless session — Không lưu trạng thái đăng nhập trên server
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                // 4. Gắn Authentication Provider (xác thực email/password)
                .authenticationProvider(authenticationProvider())

                // 5. Thêm JWT Filter TRƯỚC filter mặc định của Spring Security
                //    Để JWT filter chạy trước, set Authentication vào context
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Authentication Provider — Cầu nối giữa Spring Security và database.
     * Sử dụng DaoAuthenticationProvider:
     * - UserDetailsService: Tìm user trong DB
     * - PasswordEncoder: So sánh password (BCrypt)
     *
     * Lưu ý: Spring Security 7.x yêu cầu truyền UserDetailsService qua constructor
     * (không còn no-arg constructor và setUserDetailsService() như bản cũ).
     */
    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    /**
     * AuthenticationManager — Quản lý việc xác thực.
     * Được inject vào AuthService để gọi authenticate().
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    /**
     * CORS Configuration Source (Fix #13).
     *
     * CORS (Cross-Origin Resource Sharing) cho phép React Native app (chạy trên
     * Expo dev server http://localhost:19006) gọi API backend (http://localhost:8080).
     *
     * Mặc định browsers chặn cross-origin requests vì lý do bảo mật.
     * Ta phải BẬT CORS và CHỈ ĐỊNH các origin được phép.
     *
     * Cấu hình này:
     * - Cho phép các origin từ biến môi trường (dev: localhost:19006, prod: domain thật)
     * - Cho phép credentials (cookies, JWT trong header)
     * - Cho phép các HTTP methods cần thiết (GET, POST, PUT, DELETE, OPTIONS)
     * - Cho phép các headers cần thiết (Authorization cho JWT, Content-Type)
     * - Áp dụng cho TẤT CẢ các API endpoint (/api/**)
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "Accept"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L); // Preflight cache 1 hour

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }

    /**
     * Password Encoder — Mã hóa mật khẩu bằng BCrypt.
     * BCrypt tự động thêm salt ngẫu nhiên, chống rainbow table attack.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
