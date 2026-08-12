import { ethers } from "ethers";

import { fetchEtherscanV2 } from "../etherscan/v2";
import { normalizeNetworkId, type NetworkId } from "../chains";
import { getWalletNftTransfers } from "../../services/crypto";

export interface NftItem {
  contract: string;
  tokenId: string;
  name: string | null;
  collection: string | null;
  imageUrl: string | null;
  tokenType: "ERC721" | "ERC1155" | "UNKNOWN";
  balance: string;
}

export type NftResult =
  | { kind: "ok"; items: NftItem[]; source: "alchemy" | "etherscan"; truncated: boolean }
  | { kind: "unavailable"; reason: string };

const ALCHEMY_NETWORK: Partial<Record<NetworkId, string>> = {
  eth_mainnet: "eth-mainnet",
  eth_sepolia: "eth-sepolia",
  bsc_mainnet: "bnb-mainnet",
  polygon_mainnet: "polygon-mainnet",
  base_mainnet: "base-mainnet",
};

function normalizeImage(url: string | undefined | null): string | null {
  if (!url) return null;
  if (url.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${url.slice("ipfs://".length).replace(/^ipfs\//, "")}`;
  }
  return url.startsWith("http") ? url : null;
}

async function fetchFromAlchemy(networkId: string, owner: string, apiKey: string): Promise<NftResult> {
  const network = ALCHEMY_NETWORK[normalizeNetworkId(networkId)];
  if (!network) {
    return { kind: "unavailable", reason: "Alchemy không hỗ trợ NFT trên mạng này." };
  }

  const url = new URL(`https://${network}.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner`);
  url.searchParams.set("owner", owner);
  url.searchParams.set("withMetadata", "true");
  url.searchParams.set("pageSize", "100");

  const response = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!response.ok) {
    return { kind: "unavailable", reason: `Alchemy lỗi ${response.status}` };
  }

  const text = await response.text();
  if (!text.trim() || text.trim().startsWith("<")) {
    return { kind: "unavailable", reason: "Alchemy trả về dữ liệu không hợp lệ." };
  }

  let body: {
    ownedNfts?: Array<{
      contract?: { address?: string; name?: string; openSeaMetadata?: { collectionName?: string } };
      tokenId?: string;
      name?: string;
      tokenType?: string;
      balance?: string;
      image?: { thumbnailUrl?: string; cachedUrl?: string; originalUrl?: string };
    }>;
    pageKey?: string;
  };

  try {
    body = JSON.parse(text);
  } catch {
    return { kind: "unavailable", reason: "Không đọc được phản hồi Alchemy." };
  }

  const items = (body.ownedNfts ?? []).flatMap((nft): NftItem[] => {
    const contract = nft.contract?.address;
    if (!contract || !nft.tokenId) return [];
    return [
      {
        contract: ethers.getAddress(contract),
        tokenId: nft.tokenId,
        name: nft.name ?? null,
        collection: nft.contract?.openSeaMetadata?.collectionName ?? nft.contract?.name ?? null,
        imageUrl: normalizeImage(
          nft.image?.thumbnailUrl ?? nft.image?.cachedUrl ?? nft.image?.originalUrl,
        ),
        tokenType: nft.tokenType === "ERC1155" ? "ERC1155" : nft.tokenType === "ERC721" ? "ERC721" : "UNKNOWN",
        balance: nft.balance ?? "1",
      },
    ];
  });

  return { kind: "ok", items, source: "alchemy", truncated: Boolean(body.pageKey) };
}

interface EtherscanNftTx {
  contractAddress: string;
  tokenID: string;
  tokenName?: string;
  tokenSymbol?: string;
  from: string;
  to: string;
}

async function fetchFromBackend(walletId: string, owner: string): Promise<NftResult | null> {
  try {
    const body = await getWalletNftTransfers(walletId);
    if (body.status !== "1" || !Array.isArray(body.result)) {
      return {
        kind: "unavailable",
        reason: body.message || "Explorer từ chối yêu cầu — kiểm tra etherscan.api-key trên backend.",
      };
    }
    return buildFromTransfers(body.result, owner);
  } catch {
    return null;
  }
}

function buildFromTransfers(transfers: EtherscanNftTx[], owner: string): NftResult {
  const held = new Map<string, NftItem>();
  const target = ethers.getAddress(owner);

  for (const tx of transfers) {
    const key = `${tx.contractAddress.toLowerCase()}:${tx.tokenID}`;
    if (ethers.getAddress(tx.to) === target) {
      held.set(key, {
        contract: ethers.getAddress(tx.contractAddress),
        tokenId: tx.tokenID,
        name: tx.tokenName ? `${tx.tokenName} #${tx.tokenID}` : null,
        collection: tx.tokenName ?? tx.tokenSymbol ?? null,
        imageUrl: null,
        tokenType: "ERC721",
        balance: "1",
      });
    } else if (ethers.getAddress(tx.from) === target) {
      held.delete(key);
    }
  }

  return { kind: "ok", items: [...held.values()], source: "etherscan", truncated: transfers.length >= 1000 };
}

async function fetchFromEtherscan(networkId: string, owner: string, apiKey?: string): Promise<NftResult> {
  const body = await fetchEtherscanV2<EtherscanNftTx[] | string>(
    networkId,
    {
      module: "account",
      action: "tokennfttx",
      address: owner,
      startblock: "0",
      endblock: "latest",
      sort: "asc",
      page: "1",
      offset: "1000",
    },
    apiKey,
  );

  if (!body) {
    return {
      kind: "unavailable",
      reason: "Không kết nối được explorer — cấu hình etherscan.api-key trên backend hoặc EXPO_PUBLIC_ETHERSCAN_API_KEY.",
    };
  }
  if (body.status !== "1" || !Array.isArray(body.result)) {
    const detail = typeof body.result === "string" ? body.result : body.message;
    if (detail?.toLowerCase().includes("no transactions") || detail?.toLowerCase().includes("no record found")) {
      return { kind: "ok", items: [], source: "etherscan", truncated: false };
    }
    return { kind: "unavailable", reason: detail || body.message || "Explorer từ chối yêu cầu." };
  }

  return buildFromTransfers(body.result, owner);
}

export async function fetchNfts(params: {
  networkId: string;
  owner: string;
  walletId?: string;
  alchemyApiKey?: string;
  etherscanApiKey?: string;
}): Promise<NftResult> {
  try {
    if (params.alchemyApiKey) {
      const alchemy = await fetchFromAlchemy(params.networkId, params.owner, params.alchemyApiKey);
      if (alchemy.kind === "ok") return alchemy;
    }

    if (params.walletId) {
      const backend = await fetchFromBackend(params.walletId, params.owner);
      if (backend) return backend;
    }

    return await fetchFromEtherscan(params.networkId, params.owner, params.etherscanApiKey);
  } catch (error) {
    return {
      kind: "unavailable",
      reason: error instanceof Error ? error.message : "Không tải được NFT.",
    };
  }
}
