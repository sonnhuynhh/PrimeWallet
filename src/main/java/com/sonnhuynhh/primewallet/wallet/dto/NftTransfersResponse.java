package com.sonnhuynhh.primewallet.wallet.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

/** Kết quả `tokennfttx` từ Etherscan API V2 — dùng để dựng danh sách NFT đang giữ. */
@Data
public class NftTransfersResponse {
    private String status;
    private String message;
    private List<NftTransferRecord> result;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class NftTransferRecord {
        private String contractAddress;
        private String tokenID;
        private String tokenName;
        private String tokenSymbol;
        private String from;
        private String to;
    }
}
