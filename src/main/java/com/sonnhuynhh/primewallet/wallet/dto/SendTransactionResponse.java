package com.sonnhuynhh.primewallet.wallet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Kết quả gửi token/native coin: hash trên mạng + id bản ghi lịch sử in-app.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SendTransactionResponse {
    private String transactionHash;
    private UUID transactionId;
    private String status;
}