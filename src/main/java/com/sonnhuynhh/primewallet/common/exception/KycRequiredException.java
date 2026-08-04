package com.sonnhuynhh.primewallet.common.exception;

/**
 * Exception khi giao dịch yêu cầu KYC nhưng user chưa xác thực.
 *
 * Ví dụ: User chưa KYC (trạng thái PENDING hoặc REJECTED)
 * muốn chuyển 15 triệu VNĐ → vượt ngưỡng 10 triệu → ném exception này.
 *
 * Tại sao tạo Exception riêng thay vì dùng IllegalArgumentException?
 * → Mỗi loại lỗi cần HTTP status code khác nhau:
 *   - IllegalArgumentException → 400 Bad Request (dữ liệu không hợp lệ)
 *   - KycRequiredException → 403 Forbidden (bị cấm vì chưa đủ quyền)
 *   - ResourceNotFoundException → 404 Not Found
 *
 * → GlobalExceptionHandler sẽ bắt từng loại Exception
 *   và trả về status code chính xác cho Frontend.
 */
public class KycRequiredException extends RuntimeException {
    public KycRequiredException(String message) {
        super(message);
    }
}
