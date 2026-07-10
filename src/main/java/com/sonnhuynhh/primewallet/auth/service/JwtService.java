package com.sonnhuynhh.primewallet.auth.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

/**
 * Service xử lý toàn bộ logic liên quan đến JWT (JSON Web Token).
 *
 * JWT gồm 3 phần:
 * 1. Header: Loại token và thuật toán mã hóa
 * 2. Payload: Dữ liệu (email, role, thời hạn, ...)
 * 3. Signature: Chữ ký số để xác thực token chưa bị chỉnh sửa
 *
 * Luồng hoạt động:
 * - Đăng nhập → generateAccessToken() → trả JWT cho client
 * - Client gọi API → gửi JWT trong Header "Authorization: Bearer <token>"
 * - Server → extractEmail() + isTokenValid() → xác thực request
 */
@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.access-token-expiration}")
    private long accessTokenExpiration; // 15 phút = 900000ms

    // ==================== EXTRACT (Đọc thông tin từ Token) ====================

    /**
     * Lấy email từ JWT token.
     * Email được lưu trong trường "subject" của JWT payload.
     */
    public String extractEmail(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    /**
     * Lấy role từ JWT token.
     * Role được lưu như một custom claim "role".
     */
    public String extractRole(String token) {
        return extractClaim(token, claims -> claims.get("role", String.class));
    }

    /**
     * Lấy một claim bất kỳ từ token.
     * Sử dụng Generic + Function để linh hoạt đọc bất kỳ trường nào.
     */
    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    // ==================== GENERATE (Tạo Token) ====================

    /**
     * Tạo Access Token cho user.
     * Token chứa: email (subject), role, thời gian tạo, thời gian hết hạn.
     */
    public String generateAccessToken(UserDetails userDetails, String role) {
        Map<String, Object> extraClaims = new HashMap<>();
        extraClaims.put("role", role);
        return buildToken(extraClaims, userDetails, accessTokenExpiration);
    }

    /**
     * Xây dựng JWT token từ các thành phần.
     */
    private String buildToken(Map<String, Object> extraClaims, UserDetails userDetails, long expiration) {
        return Jwts.builder()
                .claims(extraClaims)                              // Payload: custom claims (role, ...)
                .subject(userDetails.getUsername())                // Payload: subject = email
                .issuedAt(new Date(System.currentTimeMillis()))   // Payload: thời gian tạo
                .expiration(new Date(System.currentTimeMillis() + expiration)) // Payload: hết hạn
                .signWith(getSigningKey())                        // Signature: ký bằng secret key
                .compact();                                       // Nén thành chuỗi JWT
    }

    // ==================== VALIDATE (Xác thực Token) ====================

    /**
     * Kiểm tra token có hợp lệ không.
     * Hợp lệ = email trong token khớp với user hiện tại VÀ token chưa hết hạn.
     */
    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String email = extractEmail(token);
        return email.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    /**
     * Kiểm tra token đã hết hạn chưa.
     */
    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    /**
     * Lấy thời gian hết hạn từ token.
     */
    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    // ==================== INTERNAL HELPERS ====================

    /**
     * Giải mã toàn bộ claims từ token.
     * Nếu token không hợp lệ hoặc đã bị chỉnh sửa → ném exception.
     */
    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /**
     * Tạo SecretKey từ chuỗi secret trong application.properties.
     * Sử dụng thuật toán HMAC-SHA để ký token.
     */
    private SecretKey getSigningKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
