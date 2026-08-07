package com.sonnhuynhh.primewallet.wallet.service;

import com.sonnhuynhh.primewallet.wallet.dto.OwnershipChallengeResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;
import org.web3j.crypto.Hash;
import org.web3j.utils.Numeric;

import java.math.BigInteger;

import java.security.SignatureException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service xác minh quyền sở hữu ví Crypto.
 *
 * Flow:
 * 1. Client gọi GET /ownership/challenge?address=0x... → nhận message (chứa nonce)
 * 2. Client ký message bằng private key (ethers.js: signer.signMessage(message))
 * 3. Client gửi signature → server recover address từ signature → so khớp
 *
 * Challenge có TTL (5 phút), chỉ dùng 1 lần (nonce map lưu trong memory — production dùng Redis).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OwnershipVerificationService {

    /** Lưu challenge tạm: address → nonce (đơn giản; production nên dùng Redis TTL). */
    private final Map<String, ChallengeData> challenges = new ConcurrentHashMap<>();
    private static final long CHALLENGE_TTL_SECONDS = 300; // 5 phút

    /**
     * Tạo challenge mới cho một địa chỉ.
     */
    public OwnershipChallengeResponse createChallenge(String address) {
        String nonce = UUID.randomUUID().toString().replace("-", "");
        String message = String.format("PrimeWallet: verify wallet %s with nonce %s", address.toLowerCase(), nonce);
        challenges.put(address.toLowerCase(), new ChallengeData(nonce, System.currentTimeMillis()));

        return OwnershipChallengeResponse.builder()
                .address(address)
                .nonce(nonce)
                .message(message)
                .expiresInSeconds(CHALLENGE_TTL_SECONDS)
                .build();
    }

    /**
     * Xác minh chữ ký: recover address từ signature và so sánh.
     * Signature có dạng "0x{r}{s}{v}" (65 bytes) — chuẩn ethers.js/eth_sign.
     */
    public boolean verifySignature(String address, String message, String signature) {
        try {
            String normalized = signature.startsWith("0x") ? signature.substring(2) : signature;
            byte[] signatureBytes = Numeric.hexStringToByteArray(normalized);

            if (signatureBytes.length != 65) {
                log.warn("Signature length sai: {} (expected 65, got {})", signature, signatureBytes.length);
                return false;
            }

            byte[] r = java.util.Arrays.copyOfRange(signatureBytes, 0, 32);
            byte[] s = java.util.Arrays.copyOfRange(signatureBytes, 32, 64);
            byte v = signatureBytes[64];

            // ethers.js sinh signature compact: byte cuối là 0/1 (hoặc 27/28).
            // web3j 4.x signedMessageHashToKey YÊU CẦU v ∈ [27, 34] — chuẩn hóa về 27/28.
            if (v < 27) {
                v += 27;
            }

            Sign.SignatureData sigData = new Sign.SignatureData(v, r, s);

            // eth_sign message: prefix "\x19Ethereum Signed Message:\n" + len(message) + message
            byte[] messageHash = Hash.sha3(("Ethereum Signed Message:\n" + message.length() + message).getBytes());

            BigInteger publicKey = Sign.signedMessageHashToKey(messageHash, sigData);
            // web3j recoverFromSignature trả về x||y (64 bytes = 128 hex, đã bỏ 0x04).
            // Ethereum address = 20 byte cuối của Keccak256(pubkey 64 byte không prefix).
            String pubKeyHex = Numeric.toHexStringNoPrefix(publicKey);
            // Pad về 128 hex nếu bị bỏ số 0 đầu (rare, nhưng an toàn)
            if (pubKeyHex.length() < 128) {
                pubKeyHex = "0".repeat(128 - pubKeyHex.length()) + pubKeyHex;
            }
            byte[] pubKeyBytes = Numeric.hexStringToByteArray(pubKeyHex);
            byte[] hash = Hash.sha3(pubKeyBytes);
            String addressHashHex = Numeric.toHexStringNoPrefix(hash); // 64 hex = 32 bytes
            String recoveredAddress = Keys.toChecksumAddress("0x" + addressHashHex.substring(24));

            return recoveredAddress.equalsIgnoreCase(address);

        } catch (SignatureException | IllegalArgumentException e) {
            log.warn("Xác minh chữ ký thất bại: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Kiểm tra challenge còn hợp lệ (nonce khớp + chưa hết hạn + chưa dùng).
     */
    public boolean isValidChallenge(String address, String message) {
        ChallengeData data = challenges.get(address.toLowerCase());
        if (data == null) {
            return false;
        }
        // Message phải chứa nonce của challenge
        if (!message.contains(data.nonce)) {
            return false;
        }
        // Hết hạn?
        long ageSeconds = (System.currentTimeMillis() - data.createdAt) / 1000;
        if (ageSeconds > CHALLENGE_TTL_SECONDS) {
            challenges.remove(address.toLowerCase());
            return false;
        }
        return true;
    }

    /** Xóa challenge sau khi dùng xong (tránh replay). */
    public void invalidateChallenge(String address) {
        challenges.remove(address.toLowerCase());
    }

    private record ChallengeData(String nonce, long createdAt) {}
}