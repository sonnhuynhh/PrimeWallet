package com.sonnhuynhh.primewallet.wallet.enums;

/**
 * Danh sách các mạng blockchain được hỗ trợ bởi PrimeWallet Crypto.
 *
 * Mỗi mạng gồm:
 * - id: định danh (lưu trong DB)
 * - displayName: tên hiển thị cho UI
 * - nativeSymbol: đơn vị token gốc (ETH, BNB, MATIC)
 * - chainId: Chain ID theo chuẩn EIP-155
 * - isTestnet: cờ đánh dấu mạng test
 */
public enum BlockchainNetwork {
    ETHEREUM_MAINNET("eth_mainnet", "Ethereum Mainnet", "ETH", 1L, false),
    ETH_SEPOLIA("eth_sepolia", "Ethereum Sepolia", "ETH", 11155111L, true),
    BSC_TESTNET("bsc_testnet", "BNB Smart Chain Testnet", "BNB", 97L, true),
    POLYGON_AMOY("polygon_amoy", "Polygon Amoy", "POL", 80002L, true),
    BASE_SEPOLIA("base_sepolia", "Base Sepolia", "ETH", 84532L, true);

    private final String id;
    private final String label;
    private final String nativeSymbol;
    private final Long chainId;
    private final boolean testnet;

    BlockchainNetwork(String id, String label, String nativeSymbol, Long chainId, boolean testnet) {
        this.id = id;
        this.label = label;
        this.nativeSymbol = nativeSymbol;
        this.chainId = chainId;
        this.testnet = testnet;
    }

    public String getId() { return id; }
    public String getLabel() { return label; }
    public String getNativeSymbol() { return nativeSymbol; }
    public Long getChainId() { return chainId; }
    public boolean isTestnet() { return testnet; }

    /** Tìm mạng theo id, ném lỗi rõ ràng nếu không hỗ trợ. */
    public static BlockchainNetwork fromId(String id) {
        for (BlockchainNetwork n : values()) {
            if (n.id.equalsIgnoreCase(id)) {
                return n;
            }
        }
        throw new IllegalArgumentException("Mạng blockchain không được hỗ trợ: " + id
                + ". Các mạng hợp lệ: " + java.util.Arrays.stream(values())
                .map(BlockchainNetwork::getId).toList());
    }

    /** Cho phép alias cũ "ETH_SEPOLIA" để tương thích dữ liệu đã lưu. */
    public static BlockchainNetwork fromIdWithLegacy(String id) {
        if ("ETH_SEPOLIA".equalsIgnoreCase(id) || "ETHEREUM_SEPOLIA".equalsIgnoreCase(id)) {
            return ETH_SEPOLIA;
        }
        return fromId(id);
    }
}