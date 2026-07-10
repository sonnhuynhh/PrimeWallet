package com.sonnhuynhh.primewallet.auth.security;

import com.sonnhuynhh.primewallet.auth.service.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Bộ lọc JWT — Chạy MỖI lần có request gửi đến server.
 *
 * Luồng xử lý:
 * 1. Kiểm tra header "Authorization" có chứa "Bearer <token>" không
 * 2. Nếu có → Trích xuất email từ token
 * 3. Tải UserDetails từ database
 * 4. Xác thực token (chưa hết hạn, email khớp)
 * 5. Nếu hợp lệ → Đặt Authentication vào SecurityContext
 *    → Các request sau trong chain biết user đã xác thực
 *
 * Nếu không có token hoặc token không hợp lệ → Bỏ qua (không set Authentication)
 * → Spring Security sẽ tự trả 401 Unauthorized cho các API cần xác thực.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        // 1. Lấy header Authorization
        final String authHeader = request.getHeader("Authorization");

        // 2. Kiểm tra có phải Bearer token không
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            // Không có token → chuyển tiếp cho filter tiếp theo xử lý
            filterChain.doFilter(request, response);
            return;
        }

        // 3. Cắt bỏ "Bearer " để lấy token thuần
        final String jwt = authHeader.substring(7);

        try {
            // 4. Trích xuất email từ token
            final String userEmail = jwtService.extractEmail(jwt);

            // 5. Nếu email tồn tại VÀ chưa có authentication trong context
            //    (tránh xác thực lại nếu đã authenticated)
            if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {

                // 6. Tải UserDetails từ database
                UserDetails userDetails = userDetailsService.loadUserByUsername(userEmail);

                // 7. Xác thực token
                if (jwtService.isTokenValid(jwt, userDetails)) {

                    // 8. Tạo Authentication object
                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails,
                                    null, // Không cần credentials vì đã xác thực qua JWT
                                    userDetails.getAuthorities()
                            );

                    // 9. Gắn thông tin request vào authentication
                    authToken.setDetails(
                            new WebAuthenticationDetailsSource().buildDetails(request)
                    );

                    // 10. Đặt vào SecurityContext → User được coi là đã đăng nhập
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        } catch (Exception e) {
            // Token không hợp lệ → Bỏ qua, để Spring Security xử lý
            // Không throw exception ở đây vì sẽ phá vỡ filter chain
        }

        // 11. Chuyển tiếp request cho filter/controller tiếp theo
        filterChain.doFilter(request, response);
    }
}
