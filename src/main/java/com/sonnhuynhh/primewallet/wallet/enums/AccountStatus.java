package com.sonnhuynhh.primewallet.wallet.enums;

/**
 * Trạng thái tài khoản ví.
 *
 * - ACTIVE: Ví đang hoạt động, có thể giao dịch bình thường.
 * - LOCKED: Ví bị khóa tạm thời (VD: phát hiện gian lận, quá hạn xác thực KYC).
 *           User không thể chuyển tiền ra nhưng vẫn nhận tiền được.
 * - CLOSED: Ví đã đóng vĩnh viễn, không thể thực hiện bất kỳ giao dịch nào.
 */
public enum AccountStatus {
    ACTIVE,
    LOCKED,
    CLOSED
}
