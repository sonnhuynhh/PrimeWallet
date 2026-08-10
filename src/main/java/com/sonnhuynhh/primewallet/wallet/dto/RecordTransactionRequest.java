package com.sonnhuynhh.primewallet.wallet.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Request ghi sổ một giao dịch ĐÃ được phát lên mạng bởi ví bên ngoài.
 *
 * <p>Khác {@link SendTokenRequest}: ví ngoài (MetaMask, OKX, WalletConnect…) không
 * trả về signed hex để backend broadcast — chuẩn EIP-1193 chỉ có
 * {@code eth_sendTransaction}, tức chính extension tự phát và trả về tx hash.
 * Nên với ví ngoài, backend chỉ ghi lịch sử in-app + phát Kafka event cho AI,
 * không broadcast lại.
 */
@Data
public class RecordTransactionRequest {

    @NotBlank(message = "Mạng blockchain không được để trống")
    private String blockchainNetwork;

    @NotBlank(message = "Transaction hash không được để trống")
    @Pattern(regexp = "^0x[a-fA-F0-9]{64}$", message = "Transaction hash không hợp lệ")
    private String transactionHash;

    @NotBlank(message = "Địa chỉ ví nguồn không được để trống")
    @Pattern(regexp = "^0x[a-fA-F0-9]{40}$", message = "Địa chỉ ví nguồn không hợp lệ")
    private String fromAddress;

    @NotBlank(message = "Địa chỉ ví nhận không được để trống")
    @Pattern(regexp = "^0x[a-fA-F0-9]{40}$", message = "Địa chỉ ví nhận không hợp lệ")
    private String toAddress;

    @NotBlank(message = "Số tiền không được để trống")
    private String amount;

    @NotBlank(message = "Ký hiệu token không được để trống")
    @Size(max = 10)
    private String symbol;

    /** Địa chỉ contract ERC-20 (rỗng/null nếu là native coin). */
    @Pattern(regexp = "^$|^0x[a-fA-F0-9]{40}$", message = "Contract address không hợp lệ")
    private String tokenAddress;

    /** Loại giao dịch: SEND, SWAP, REVOKE, CONTRACT… Mặc định SEND. */
    @Size(max = 20)
    private String type;

    /** Mô tả hiển thị trên UI (vd. "Swap USDC → WETH"). */
    @Size(max = 500)
    private String description;
}
