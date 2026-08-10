package com.sonnhuynhh.primewallet.wallet.service;

import com.sonnhuynhh.primewallet.config.Web3jProvider;
import com.sonnhuynhh.primewallet.wallet.enums.BlockchainNetwork;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.methods.response.EthTransaction;
import org.web3j.protocol.core.methods.response.Log;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.utils.Numeric;

import java.math.BigInteger;
import java.util.List;
import java.util.Locale;

/**
 * Xác minh giao dịch on-chain gửi crypto tới ví treasury của nền tảng.
 */
@Component
@RequiredArgsConstructor
public class BridgeDepositVerifier {

    /** keccak256("Transfer(address,address,uint256)") */
    private static final String TRANSFER_TOPIC =
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

    private final Web3jProvider web3jProvider;

    public record VerifiedDeposit(
            String fromAddress,
            String toAddress,
            BigInteger amountRaw,
            boolean nativeCoin
    ) {}

    public VerifiedDeposit verify(
            BlockchainNetwork network,
            String txHash,
            String expectedFrom,
            String expectedTreasury,
            String tokenContract,
            BigInteger expectedAmountRaw
    ) throws Exception {
        Web3j web3j = web3jProvider.getWeb3j(network);
        String hash = txHash.startsWith("0x") ? txHash : "0x" + txHash;

        TransactionReceipt receipt = web3j.ethGetTransactionReceipt(hash).send()
                .getTransactionReceipt()
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy giao dịch on-chain"));

        if (!"0x1".equalsIgnoreCase(receipt.getStatus())) {
            throw new IllegalArgumentException("Giao dịch on-chain thất bại");
        }

        String treasury = normalize(expectedTreasury);
        String from = normalize(expectedFrom);

        if (tokenContract == null || tokenContract.isBlank()) {
            EthTransaction ethTx = web3j.ethGetTransactionByHash(hash).send();
            if (!ethTx.getTransaction().isPresent()) {
                throw new IllegalArgumentException("Không đọc được giao dịch");
            }
            var tx = ethTx.getTransaction().get();
            String txTo = normalize(tx.getTo());
            String txFrom = normalize(tx.getFrom());
            BigInteger value = tx.getValue();

            if (!txFrom.equals(from)) {
                throw new IllegalArgumentException("Địa chỉ gửi không khớp với ví đã chọn");
            }
            if (!txTo.equals(treasury)) {
                throw new IllegalArgumentException("Giao dịch không gửi tới ví treasury");
            }
            if (value.compareTo(expectedAmountRaw) < 0) {
                throw new IllegalArgumentException("Số lượng gửi không đủ so với báo giá");
            }
            return new VerifiedDeposit(txFrom, txTo, value, true);
        }

        String contract = normalize(tokenContract);
        for (Log log : receipt.getLogs()) {
            if (log.getTopics() == null || log.getTopics().isEmpty()) continue;
            if (!TRANSFER_TOPIC.equalsIgnoreCase(log.getTopics().get(0))) continue;
            if (!normalize(log.getAddress()).equals(contract)) continue;

            String logFrom = topicToAddress(log.getTopics().get(1));
            String logTo = topicToAddress(log.getTopics().get(2));
            BigInteger amount = Numeric.toBigInt(log.getData());

            if (logFrom.equals(from) && logTo.equals(treasury)
                    && amount.compareTo(expectedAmountRaw) >= 0) {
                return new VerifiedDeposit(logFrom, logTo, amount, false);
            }
        }
        throw new IllegalArgumentException("Không tìm thấy chuyển token phù hợp trong giao dịch");
    }

    private static String topicToAddress(String topic) {
        String hex = topic.startsWith("0x") ? topic.substring(2) : topic;
        return normalize("0x" + hex.substring(hex.length() - 40));
    }

    private static String normalize(String address) {
        return address.toLowerCase(Locale.ROOT);
    }
}
