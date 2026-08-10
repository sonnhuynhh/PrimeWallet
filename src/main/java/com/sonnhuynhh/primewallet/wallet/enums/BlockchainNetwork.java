package com.sonnhuynhh.primewallet.wallet.enums;

import java.util.Map;

/**
 * Danh sách các mạng blockchain được hỗ trợ bởi PrimeWallet Crypto.
 *
 * Chỉ Sepolia là testnet; BSC / Polygon / Base dùng mainnet.
 */
public enum BlockchainNetwork {
    ETHEREUM_MAINNET("eth_mainnet", "Ethereum Mainnet", "ETH", 1L, false),
    ETH_SEPOLIA("eth_sepolia", "Ethereum Sepolia", "ETH", 11155111L, true),
    BSC_MAINNET("bsc_mainnet", "BNB Smart Chain", "BNB", 56L, false),
    POLYGON_MAINNET("polygon_mainnet", "Polygon", "POL", 137L, false),
    BASE_MAINNET("base_mainnet", "Base", "ETH", 8453L, false);

    private static final Map<String, BlockchainNetwork> LEGACY_ALIASES = Map.of(
            "bsc_testnet", BSC_MAINNET,
            "polygon_amoy", POLYGON_MAINNET,
            "base_sepolia", BASE_MAINNET
    );

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

    /** Alias cũ (testnet BSC/Polygon/Base + ETH_SEPOLIA viết hoa). */
    public static BlockchainNetwork fromIdWithLegacy(String id) {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("Mạng blockchain không được để trống");
        }
        if ("ETH_SEPOLIA".equalsIgnoreCase(id) || "ETHEREUM_SEPOLIA".equalsIgnoreCase(id)) {
            return ETH_SEPOLIA;
        }
        BlockchainNetwork legacy = LEGACY_ALIASES.get(id.toLowerCase());
        if (legacy != null) {
            return legacy;
        }
        return fromId(id);
    }
}
