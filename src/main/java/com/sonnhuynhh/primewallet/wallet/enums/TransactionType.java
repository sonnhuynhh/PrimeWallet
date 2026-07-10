package com.sonnhuynhh.primewallet.wallet.enums;

/**
 * Loại giao dịch trong hệ thống.
 *
 * - TOPUP:    Nạp tiền vào ví (từ ngân hàng/nguồn ngoài → ví).
 * - WITHDRAW: Rút tiền từ ví (ví → ngân hàng).
 * - TRANSFER: Chuyển tiền nội bộ giữa 2 ví PrimeWallet.
 * - PAYMENT:  Thanh toán hóa đơn, dịch vụ (điện, nước, internet,...).
 */
public enum TransactionType {
    TOPUP,
    WITHDRAW,
    TRANSFER,
    PAYMENT
}
