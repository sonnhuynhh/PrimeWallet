package com.sonnhuynhh.primewallet.wallet.enums;

/**
 * Loại bút toán trong sổ cái — Trái tim của mô hình Ghi sổ kép.
 *
 * Nguyên tắc kế toán:
 * - DEBIT (Ghi nợ):  Trừ tiền khỏi tài khoản. Tiền đi RA.
 * - CREDIT (Ghi có): Cộng tiền vào tài khoản. Tiền đi VÀO.
 *
 * Ví dụ: User A chuyển 100.000đ cho User B
 * → Tạo 1 dòng DEBIT  100.000đ ở tài khoản A (trừ tiền A)
 * → Tạo 1 dòng CREDIT 100.000đ ở tài khoản B (cộng tiền B)
 *
 * Quy tắc bất biến (Invariant):
 * Tổng DEBIT toàn hệ thống == Tổng CREDIT toàn hệ thống (luôn = 0 khi trừ đi).
 * Nếu vi phạm → hệ thống bị lỗi nghiêm trọng, cần kiểm tra ngay.
 *
 * Số dư tài khoản = SUM(CREDIT) - SUM(DEBIT) của tài khoản đó.
 */
public enum EntryType {
    DEBIT,
    CREDIT
}
