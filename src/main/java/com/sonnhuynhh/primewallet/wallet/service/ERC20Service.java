package com.sonnhuynhh.primewallet.wallet.service;

import com.sonnhuynhh.primewallet.config.TokenProperties;
import com.sonnhuynhh.primewallet.config.Web3jProvider;
import com.sonnhuynhh.primewallet.wallet.dto.TokenBalanceResponse;
import com.sonnhuynhh.primewallet.wallet.dto.TokenConfigResponse;
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
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Service đọc số dư token ERC-20 (USDT, USDC, DAI...) trên các mạng EVM.
 *
 * Không sinh Smart Contract wrapper (tránh nặng nề) mà gọi trực tiếp
 * phương thức balanceOf(address) qua JSON-RPC eth_call với function selector
 * được mã hóa bằng FunctionEncoder.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ERC20Service {

    private final TokenProperties tokenProperties;
    private final Web3jProvider web3jProvider;

    /**
     * Lấy danh sách số dư token ERC20 mặc định (đã cấu hình) cho một địa chỉ ví.
     * Bỏ qua token gọi lỗi (contract sai/đổi mạng) để không làm vỡ response.
     */
    public List<TokenBalanceResponse> getTokenBalances(BlockchainNetwork network, String address) {
        Web3j web3j = web3jProvider.getWeb3j(network);
        List<TokenBalanceResponse> result = new ArrayList<>();

        List<TokenProperties.TokenConfig> tokens = tokenProperties.getTokens().getOrDefault(
                network.getId(), Collections.emptyList());

        for (TokenProperties.TokenConfig token : tokens) {
            TokenBalanceResponse response = readBalance(web3j, network, address, token.getContract(),
                    token.getSymbol(), token.getName(), token.getDecimals());
            if (response != null) {
                result.add(response);
            }
        }
        return result;
    }

    /**
     * Đọc số dư 1 token ERC20 cụ thể theo contract address (với symbol/decimals từ config).
     */
    public TokenBalanceResponse getTokenBalance(BlockchainNetwork network, String address,
                                                String contractAddress) {
        // Tìm symbol/decimals từ config theo contract
        List<TokenProperties.TokenConfig> tokens = tokenProperties.getTokens().getOrDefault(
                network.getId(), Collections.emptyList());
        for (TokenProperties.TokenConfig t : tokens) {
            if (t.getContract().equalsIgnoreCase(contractAddress)) {
                return readBalance(web3jProvider.getWeb3j(network), network, address,
                        contractAddress, t.getSymbol(), t.getName(), t.getDecimals());
            }
        }
        throw new IllegalArgumentException("Token chưa được cấu hình cho mạng " + network.getId()
                + " với contract " + contractAddress);
    }

    /**
     * Gọi balanceOf(owner) qua eth_call.
     */
    private TokenBalanceResponse readBalance(Web3j web3j, BlockchainNetwork network, String address,
                                             String contractAddress, String symbol, String name, int decimals) {
        try {
            Function function = new Function(
                    "balanceOf",
                    Collections.singletonList(new Address(address)),
                    Collections.singletonList(new TypeReference<Uint256>() {})
            );

            String encoded = FunctionEncoder.encode(function);
            Transaction call = Transaction.createEthCallTransaction(address, contractAddress, encoded);

            EthCall ethCall = web3j.ethCall(call, DefaultBlockParameterName.LATEST).send();
            String result = ethCall.getValue();
            if (result == null || result.equals("0x")
                    || result.matches("0x0*")) {
                return null; // balance = 0 hoặc lỗi → bỏ qua
            }

            BigInteger rawBalance = new BigInteger(result.substring(2), 16);
            BigDecimal balance = new BigDecimal(rawBalance).movePointLeft(decimals);

            return TokenBalanceResponse.builder()
                    .contractAddress(contractAddress)
                    .symbol(symbol)
                    .name(name)
                    .decimals(decimals)
                    .balance(balance)
                    .rawBalance(rawBalance.toString())
                    .build();
        } catch (Exception e) {
            log.warn("Đọc token {} ({} / {}) lỗi: {}", symbol, address, network.getId(), e.getMessage());
            return null;
        }
    }

    /**
     * Lấy danh sách token đã cấu hình cho một mạng (dùng trong UI token picker).
     */
    public List<TokenConfigResponse> getSupportedTokens(BlockchainNetwork network) {
        return tokenProperties.getTokens()
                .getOrDefault(network.getId(), Collections.emptyList())
                .stream()
                .map(t -> TokenConfigResponse.builder()
                        .symbol(t.getSymbol())
                        .name(t.getName())
                        .decimals(t.getDecimals())
                        .contract(t.getContract())
                        .build())
                .toList();
    }
}