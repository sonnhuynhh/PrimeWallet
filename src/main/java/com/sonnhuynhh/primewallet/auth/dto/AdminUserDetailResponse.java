package com.sonnhuynhh.primewallet.auth.dto;

import com.sonnhuynhh.primewallet.wallet.dto.AccountResponse;
import com.sonnhuynhh.primewallet.wallet.dto.TransactionResponse;
import lombok.*;

import java.util.List;
import java.util.Map;

/**
 * Chi tiết user dành cho Admin — hồ sơ + ví + giao dịch gần đây + risk AI.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminUserDetailResponse {

    private AdminUserResponse user;
    private List<AccountResponse> accounts;
    private List<TransactionResponse> recentTransactions;
    private Map<String, Object> riskScore;
}
