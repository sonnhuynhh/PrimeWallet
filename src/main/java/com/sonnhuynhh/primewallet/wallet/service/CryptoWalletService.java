package com.sonnhuynhh.primewallet.wallet.service;

import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException;
import com.sonnhuynhh.primewallet.wallet.dto.CryptoWalletResponse;
import com.sonnhuynhh.primewallet.wallet.dto.LinkWalletRequest;
import com.sonnhuynhh.primewallet.wallet.entity.CryptoWallet;
import com.sonnhuynhh.primewallet.wallet.repository.CryptoWalletRepository;
import com.sonnhuynhh.primewallet.common.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CryptoWalletService {

    private final CryptoWalletRepository cryptoWalletRepository;
    private final UserRepository userRepository;
    private final org.web3j.protocol.Web3j web3j;
    private final EtherscanService etherscanService;
    private final AuditService auditService;

    @Transactional
    public CryptoWalletResponse linkWallet(UUID userId, LinkWalletRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng không tồn tại"));

        // Check if user already linked a wallet for this network
        java.util.Optional<CryptoWallet> existingWalletOpt = cryptoWalletRepository
                .findByUserIdAndBlockchainNetwork(userId, request.getBlockchainNetwork());

        if (existingWalletOpt.isPresent()) {
            CryptoWallet existing = existingWalletOpt.get();
            if (existing.getWalletAddress().equalsIgnoreCase(request.getWalletAddress())) {
                // If it's the same wallet, just return it instead of throwing an error
                return mapToResponse(existing);
            } else {
                throw new IllegalArgumentException(
                        "Người dùng đã có ví khác được liên kết cho mạng này: " + request.getBlockchainNetwork());
            }
        }

        // Validate if address is already linked to someone else
        if (cryptoWalletRepository.existsByWalletAddress(request.getWalletAddress())) {
            throw new IllegalArgumentException("Địa chỉ ví đã được liên kết với tài khoản khác");
        }

        CryptoWallet wallet = CryptoWallet.builder()
                .user(user)
                .walletAddress(request.getWalletAddress())
                .blockchainNetwork(request.getBlockchainNetwork())
                .build();

        CryptoWallet savedWallet = cryptoWalletRepository.save(wallet);

        auditService.log(userId, "LINK_WALLET", String.format("Liên kết ví Web3 %s (Mạng: %s)", request.getWalletAddress(), request.getBlockchainNetwork()), null);

        return mapToResponse(savedWallet);
    }

    public List<CryptoWalletResponse> getLinkedWallets(UUID userId) {
        return cryptoWalletRepository.findByUserId(userId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public com.sonnhuynhh.primewallet.wallet.dto.WalletBalanceResponse getWalletBalance(UUID userId, UUID walletId) {
        CryptoWallet wallet = cryptoWalletRepository.findById(walletId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ví"));

        if (!wallet.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Không có quyền truy cập ví này");
        }

        java.math.BigInteger wei = null;

        try {
            org.web3j.protocol.core.methods.response.EthGetBalance balanceResponse = web3j.ethGetBalance(
                    wallet.getWalletAddress(),
                    org.web3j.protocol.core.DefaultBlockParameterName.LATEST).send();
            wei = balanceResponse.getBalance();
        } catch (Exception e) {
            System.err.println("Web3j failed to fetch balance, falling back to Etherscan... " + e.getMessage());
            wei = etherscanService.getWalletBalance(wallet.getWalletAddress());
        }

        if (wei == null) {
            throw new RuntimeException("Không thể lấy số dư từ blockchain (cả RPC và Etherscan đều lỗi)");
        }

        java.math.BigDecimal eth = org.web3j.utils.Convert.fromWei(new java.math.BigDecimal(wei),
                org.web3j.utils.Convert.Unit.ETHER);

        return com.sonnhuynhh.primewallet.wallet.dto.WalletBalanceResponse.builder()
                .walletId(wallet.getId())
                .walletAddress(wallet.getWalletAddress())
                .blockchainNetwork(wallet.getBlockchainNetwork())
                .balanceWei(wei.toString())
                .balanceEth(eth)
                .build();
    }

    private CryptoWalletResponse mapToResponse(CryptoWallet wallet) {
        return CryptoWalletResponse.builder()
                .id(wallet.getId())
                .walletAddress(wallet.getWalletAddress())
                .blockchainNetwork(wallet.getBlockchainNetwork())
                .linkedAt(wallet.getCreatedAt())
                .build();
    }
}
