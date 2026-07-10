package com.sonnhuynhh.primewallet.common.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Chuẩn response wrapper cho toàn bộ API.
 * Mọi response trả về client đều đi qua class này để đảm bảo nhất quán.
 *
 * Ví dụ thành công:
 * {
 *   "success": true,
 *   "message": "Đăng ký thành công",
 *   "data": { ... },
 *   "timestamp": "2024-01-01T00:00:00"
 * }
 *
 * Ví dụ lỗi:
 * {
 *   "success": false,
 *   "message": "Email đã tồn tại",
 *   "timestamp": "2024-01-01T00:00:00"
 * }
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL) // Ẩn các field null trong JSON response
public class ApiResponse<T> {

    private boolean success;
    private String message;
    private T data;

    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();

    // ==================== FACTORY METHODS ====================

    public static <T> ApiResponse<T> success(String message, T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .message(message)
                .data(data)
                .build();
    }

    public static <T> ApiResponse<T> success(String message) {
        return ApiResponse.<T>builder()
                .success(true)
                .message(message)
                .build();
    }

    public static <T> ApiResponse<T> error(String message) {
        return ApiResponse.<T>builder()
                .success(false)
                .message(message)
                .build();
    }
}
