package com.sonnhuynhh.primewallet.wallet.service;

import com.sonnhuynhh.primewallet.config.Web3jProvider;
import com.sonnhuynhh.primewallet.wallet.dto.EstimateGasResponse;
import com.sonnhuynhh.primewallet.wallet.enums.BlockchainNetwork;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthEstimateGas;
import org.web3j.protocol.core.methods.response.EthGasPrice;
import org.web3j.utils.Convert;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.Collections;

/**
 * Service tính toán / ước tính chi phí gas trước khi gửi giao dịch.
 * Giúp UI hiển thị preview phí giao dịch trước khi user xác nhận (transparency).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GasEstimationService {

    private final Web3jProvider web3jProvider;

    /**
     * Ước tính gas cho native coin transfer.
     */
    public EstimateGasResponse estimateNativeTransfer(BlockchainNetwork network, String from, String to, String amountEth) {
        Web3j web3j = web3jProvider.getWeb3j(network);
        BigInteger value = Convert.toWei(new BigDecimal(amountEth), Convert.Unit.ETHER).toBigIntegerExact();

        try {
            EthGasPrice gasPrice = web3j.ethGasPrice().send();
            Transaction tx = Transaction.createEtherTransaction(from, null, gasPrice.getGasPrice(), BigInteger.valueOf(21000), to, value);
            EthEstimateGas estimate = web3j.ethEstimateGas(tx).send();

            BigInteger gasLimit = estimate.getAmountUsed();
            BigInteger totalFeeWei = (gasLimit != null ? gasLimit : BigInteger.valueOf(21000))
                    .multiply(gasPrice.getGasPrice());

            return EstimateGasResponse.builder()
                    .gasLimit(gasLimit != null ? gasLimit : BigInteger.valueOf(21000))
                    .gasPriceWei(gasPrice.getGasPrice())
                    .totalFeeWei(totalFeeWei)
                    .totalFeeEth(Convert.fromWei(new BigDecimal(totalFeeWei), Convert.Unit.ETHER))
                    .nativeSymbol(network.getNativeSymbol())
                    .build();
        } catch (Exception e) {
            // Fallback: dùng gas limit mặc định 21000 cho transfer native
            log.warn("Estimate gas lỗi, fallback 21000: {}", e.getMessage());
            try {
                EthGasPrice gasPrice = web3j.ethGasPrice().send();
                BigInteger totalFeeWei = BigInteger.valueOf(21000).multiply(gasPrice.getGasPrice());
                return EstimateGasResponse.builder()
                        .gasLimit(BigInteger.valueOf(21000))
                        .gasPriceWei(gasPrice.getGasPrice())
                        .totalFeeWei(totalFeeWei)
                        .totalFeeEth(Convert.fromWei(new BigDecimal(totalFeeWei), Convert.Unit.ETHER))
                        .nativeSymbol(network.getNativeSymbol())
                        .build();
            } catch (Exception ex) {
                log.error("Không lấy được gas price: {}", ex.getMessage());
                return EstimateGasResponse.builder()
                        .gasLimit(BigInteger.valueOf(21000))
                        .nativeSymbol(network.getNativeSymbol())
                        .build();
            }
        }
    }

    /**
     * Ước gas cho token ERC-20 transfer (cần mã hóa call transfer(to, value)).
     */
    public EstimateGasResponse estimateTokenTransfer(BlockchainNetwork network, String from,
                                                     String to, String contractAddress, String amountWei) {
        Web3j web3j = web3jProvider.getWeb3j(network);

        try {
            Function function = new Function(
                    "transfer",
                    java.util.Arrays.asList(new Address(to), new Uint256(new BigInteger(amountWei))),
                    Collections.singletonList(new TypeReference<org.web3j.abi.datatypes.Bool>() {})
            );
            String encoded = FunctionEncoder.encode(function);

            EthGasPrice gasPrice = web3j.ethGasPrice().send();
            Transaction tx = Transaction.createFunctionCallTransaction(from, null, gasPrice.getGasPrice(), null, contractAddress, encoded);
            EthEstimateGas estimate = web3j.ethEstimateGas(tx).send();

            BigInteger gasLimit = estimate.getAmountUsed();
            BigInteger totalFee = gasLimit.multiply(gasPrice.getGasPrice());

            return EstimateGasResponse.builder()
                    .gasLimit(gasLimit)
                    .gasPriceWei(gasPrice.getGasPrice())
                    .totalFeeWei(totalFee)
                    .totalFeeEth(Convert.fromWei(new BigDecimal(totalFee), Convert.Unit.ETHER))
                    .nativeSymbol(network.getNativeSymbol())
                    .build();
        } catch (Exception e) {
            log.warn("Estimate token gas lỗi, fallback 60000: {}", e.getMessage());
            try {
                EthGasPrice gasPrice = web3j.ethGasPrice().send();
                BigInteger totalFeeWei = BigInteger.valueOf(60000).multiply(gasPrice.getGasPrice());
                return EstimateGasResponse.builder()
                        .gasLimit(BigInteger.valueOf(60000))
                        .gasPriceWei(gasPrice.getGasPrice())
                        .totalFeeWei(totalFeeWei)
                        .totalFeeEth(Convert.fromWei(new BigDecimal(totalFeeWei), Convert.Unit.ETHER))
                        .nativeSymbol(network.getNativeSymbol())
                        .build();
            } catch (Exception ex) {
                return EstimateGasResponse.builder()
                        .gasLimit(BigInteger.valueOf(60000))
                        .nativeSymbol(network.getNativeSymbol())
                        .build();
            }
        }
    }
}