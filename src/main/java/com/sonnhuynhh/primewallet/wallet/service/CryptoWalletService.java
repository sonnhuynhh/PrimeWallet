package com.sonnhuynhh.primewallet.wallet.service;

import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException;
import com.sonnhuynhh.primewallet.common.service.AuditService;
import com.sonnhuynhh.primewallet.config.Web3jProvider;
import com.sonnhuynhh.primewallet.wallet.dto.*;
import com.sonnhuynhh.primewallet.wallet.entity.CryptoTransaction;
import com.sonnhuynhh.primewallet.wallet.entity.CryptoWallet;
import com.sonnhuynhh.primewallet.wallet.enums.BlockchainNetwork;
import com.sonnhuynhh.primewallet.wallet.repository.CryptoTransactionRepository;
import com.sonnhuynhh.primewallet.wallet.repository.CryptoWalletRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.response.EthGetBalance;
import org.web3j.utils.Convert;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service quản lý ví Crypto (kiến trúc Non-Custodial — chỉ lưu public address).
 *
 * Tính năng:
 * - Liên kết ví (link), hỗ trợ NHIỀU ví trên cùng mạng
 * - Xem số dư native coin + token ERC-20 (multi-network)
 * - Lịch sử giao dịch on-chain (qua Etherscan/explorer) + lịch sử user thực hiện trong app
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CryptoWalletService {

    private final CryptoWalletRepository cryptoWalletRepository;
    private final CryptoTransactionRepository cryptoTransactionRepository;
    private final UserRepository userRepository;
    private final Web3jProvider web3jProvider;
    private final EtherscanService etherscanService;
    private final ERC20Service erc20Service;
    private final AuditService auditService;

    // ==================== LINK WALLET ====================

    @Transactional
    public CryptoWalletResponse linkWallet(UUID userId, LinkWalletRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng không tồn tại"));

        // Chuẩn hóa network id (hỗ trợ cả alias cũ "ETH_SEPOLIA")
        BlockchainNetwork network = BlockchainNetwork.fromIdWithLegacy(request.getBlockchainNetwork());
        String networkId = network.getId();

        // Một địa chỉ dùng được trên mọi mạng EVM, nên khoá chống trùng là cặp
        // (địa chỉ, mạng) chứ không phải riêng địa chỉ:
        // - cùng user, cùng mạng  → idempotent, trả lại ví cũ
        // - user khác, cùng mạng  → chặn (không cho chiếm địa chỉ người khác)
        // - cùng user, mạng khác  → cho phép, đây chính là luồng đổi mạng
        Optional<CryptoWallet> sameAddressOnNetwork =
                cryptoWalletRepository.findByWalletAddressAndBlockchainNetwork(
                        request.getWalletAddress(), networkId);
        if (sameAddressOnNetwork.isPresent()) {
            CryptoWallet existing = sameAddressOnNetwork.get();
            if (existing.getUser().getId().equals(userId)) {
                return toCryptoWalletResponse(existing);
            }
            throw new IllegalArgumentException(
                    "Địa chỉ ví này đã được liên kết với tài khoản khác trên mạng " + network.getLabel());
        }

        // Ví đầu tiên của user trên mạng này là PRIMARY.
        boolean isPrimary = cryptoWalletRepository
                .findByUserIdAndBlockchainNetwork(userId, networkId).isEmpty();

        CryptoWallet wallet = CryptoWallet.builder()
                .user(user)
                .walletAddress(request.getWalletAddress())
                .blockchainNetwork(networkId)
                .label(request.getLabel())
                .primary(isPrimary)
                .build();

        CryptoWallet saved = cryptoWalletRepository.save(wallet);
        auditService.log(userId, "LINK_WALLET",
                String.format("Liên kết ví Web3 %s trên %s", request.getWalletAddress(), network.getLabel()), null);

        return toCryptoWalletResponse(saved);
    }

    // ==================== GETTERS ====================

    @Transactional(readOnly = true)
    public List<CryptoWalletResponse> getLinkedWallets(UUID userId) {
        return cryptoWalletRepository.findByUserIdOrderByPrimaryDescCreatedAtAsc(userId).stream()
                .map(this::toCryptoWalletResponse)
                .collect(Collectors.toList());
    }

    /**
     * Số dư của 1 ví: native coin + token ERC-20, theo mạng của ví.
     */
    public WalletBalanceResponse getWalletBalance(UUID userId, UUID walletId) {
        CryptoWallet wallet = findByOwner(userId, walletId);
        BlockchainNetwork network = BlockchainNetwork.fromIdWithLegacy(wallet.getBlockchainNetwork());

        BigInteger wei = fetchNativeBalance(wallet.getWalletAddress(), network);
        BigDecimal balance = wei == null ? BigDecimal.ZERO
                : Convert.fromWei(new BigDecimal(wei), Convert.Unit.ETHER);

        List<TokenBalanceResponse> tokens = Collections.emptyList();
        try {
            tokens = erc20Service.getTokenBalances(network, wallet.getWalletAddress());
        } catch (Exception e) {
            log.warn("Không lấy được token balances cho {} trên {}: {}",
                    wallet.getWalletAddress(), network.getId(), e.getMessage());
        }

        return WalletBalanceResponse.builder()
                .walletId(wallet.getId())
                .walletAddress(wallet.getWalletAddress())
                .blockchainNetwork(network.getId())
                .networkLabel(network.getLabel())
                .nativeSymbol(network.getNativeSymbol())
                .chainId(web3jProvider.getChainId(network))
                .balanceEth(balance)
                .balanceWei(wei != null ? wei.toString() : "0")
                .tokens(tokens)
                .build();
    }

    /**
     * Số dư 1 token ERC-20 cụ thể của một ví.
     */
    public TokenBalanceResponse getTokenBalanceOfWallet(UUID userId, UUID walletId, String contractAddress) {
        CryptoWallet wallet = findByOwner(userId, walletId);
        BlockchainNetwork network = BlockchainNetwork.fromIdWithLegacy(wallet.getBlockchainNetwork());
        return erc20Service.getTokenBalance(network, wallet.getWalletAddress(), contractAddress);
    }

    /**
     * Số dư token ERC-20 cho bất kỳ địa chỉ nào (dùng trong kiểm tra số dư khi gửi).
     */
    public TokenBalanceResponse getTokenBalanceByAddress(BlockchainNetwork network, String address, String contractAddress) {
        return erc20Service.getTokenBalance(network, address, contractAddress);
    }

    /**
     * Danh sách token được hỗ trợ cho một mạng.
     */
    public List<TokenConfigResponse> getSupportedTokensForNetwork(BlockchainNetwork network) {
        return erc20Service.getSupportedTokens(network);
    }

    /**
     * Lịch sử on-chain từ Etherscan/explorer theo mạng của ví.
     */
    public EtherscanResponse getWalletHistory(UUID userId, UUID walletId) {
        CryptoWallet wallet = findByOwner(userId, walletId);
        BlockchainNetwork network = BlockchainNetwork.fromIdWithLegacy(wallet.getBlockchainNetwork());
        return etherscanService.getTransactionHistory(wallet.getWalletAddress(), network);
    }

    /**
     * Lịch sử giao dịch user thực hiện trong app (PENDING/SUCCESS/FAILED).
     */
    @Transactional(readOnly = true)
    public Page<CryptoTransactionResponse> getMyCryptoTransactions(UUID userId, UUID walletId, Pageable pageable) {
        CryptoWallet wallet = findByOwner(userId, walletId);
        return cryptoTransactionRepository.findByWalletIdOrderByCreatedAtDesc(wallet.getId(), pageable)
                .map(this::toCryptoTransactionResponse);
    }

    // ==================== OWNERSHIP VERIFY ====================

    public CryptoWallet findByOwner(UUID userId, UUID walletId) {
        CryptoWallet wallet = cryptoWalletRepository.findById(walletId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ví"));
        if (!wallet.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Không có quyền truy cập ví này");
        }
        return wallet;
    }

    /**
     * Tìm ví của user theo địa chỉ + mạng (dùng khi gửi giao dịch để lưu lịch sử).
     *
     * <p>Phải kèm mạng: từ khi một địa chỉ được phép liên kết trên nhiều mạng,
     * tra theo mỗi địa chỉ có thể khớp nhiều dòng và ném NonUniqueResultException.
     */
    public CryptoWallet findByOwnerAndAddress(UUID userId, String walletAddress, String blockchainNetwork) {
        return cryptoWalletRepository
                .findByWalletAddressAndBlockchainNetworkAndUser_Id(walletAddress, blockchainNetwork, userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy ví " + walletAddress + " trên mạng " + blockchainNetwork));
    }

    // ==================== HELPERS ====================

    private BigInteger fetchNativeBalance(String address, BlockchainNetwork network) {
        try {
            Web3j web3j = web3jProvider.getWeb3j(network);
            EthGetBalance balanceResponse = web3j.ethGetBalance(address, DefaultBlockParameterName.LATEST).send();
            return balanceResponse.getBalance();
        } catch (Exception e) {
            log.warn("Web3j balance thất bại {} on {}: {}, fallback Etherscan",
                    address, network.getId(), e.getMessage());
            return etherscanService.getWalletBalance(address, network);
        }
    }

    /**
     * Lưu một giao dịch Crypto do user phát hành (gọi từ CryptoTransactionService).
     */
    @Transactional
    public CryptoTransaction saveTransaction(CryptoTransaction tx) {
        return cryptoTransactionRepository.save(tx);
    }

    /**
     * Xóa một ví đã liên kết khỏi tài khoản user.
     * Không ảnh hưởng tới tài sản on-chain.
     */
    @Transactional
    public void deleteWallet(CryptoWallet wallet) {
        cryptoWalletRepository.delete(wallet);
        auditService.log(wallet.getUser().getId(), "UNLINK_WALLET",
                String.format("Đã xóa ví %s trên %s", wallet.getWalletAddress(), wallet.getBlockchainNetwork()), null);
    }

    private CryptoWalletResponse toCryptoWalletResponse(CryptoWallet wallet) {
        return CryptoWalletResponse.builder()
                .id(wallet.getId())
                .walletAddress(wallet.getWalletAddress())
                .blockchainNetwork(wallet.getBlockchainNetwork())
                .label(wallet.getLabel())
                .primary(wallet.isPrimary())
                .linkedAt(wallet.getCreatedAt())
                .build();
    }

    private CryptoTransactionResponse toCryptoTransactionResponse(CryptoTransaction tx) {
        return CryptoTransactionResponse.builder()
                .id(tx.getId())
                .type(tx.getType())
                .txHash(tx.getTxHash())
                .fromAddress(tx.getFromAddress())
                .toAddress(tx.getToAddress())
                .amount(tx.getAmount())
                .symbol(tx.getSymbol())
                .tokenAddress(tx.getTokenAddress())
                .gasPriceWei(tx.getGasPriceWei())
                .gasLimit(tx.getGasLimit())
                .feeWei(tx.getFeeWei())
                .status(tx.getStatus())
                .description(tx.getDescription())
                .createdAt(tx.getCreatedAt())
                .build();
    }
}