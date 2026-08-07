package com.sonnhuynhh.primewallet.wallet.dto;

import lombok.Data;
import java.util.List;

@Data
public class EtherscanResponse {
    private String status;
    private String message;
    private List<TransactionRecord> result;

    @Data
    public static class TransactionRecord {
        private String blockNumber;
        private String timeStamp;
        private String hash;
        private String nonce;
        private String blockHash;
        private String transactionIndex;
        private String from;
        private String to;
        private String value;
        private String gas;
        private String gasPrice;
        private String isError;
        private String txreceipt_status;
        private String input;
        private String contractAddress;
        private String cumulativeGasUsed;
        private String gasUsed;
        private String confirmations;
        private String methodId;
        private String functionName;
    }
}
