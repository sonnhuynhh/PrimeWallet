import { getAddress, type Address } from 'viem';
import { getPublicClient } from '@/lib/wagmi/clients';
import { fetchEtherscanV2 } from '@/lib/etherscan/v2';
import { formatExplorerError } from '@/lib/etherscan/errors';
import { normalizeNetworkId, type NetworkId } from '@/lib/wagmi/chains';
import { getWalletNftTransfers } from '@/services/crypto';
import { HttpError } from '@/services/http';
import type { NftTransferRecord } from '@/types/crypto';

/**
 * Danh sách NFT của một ví.
 *
 * Nguồn dữ liệu (theo thứ tự ưu tiên):
 * 1. **Alchemy NFT v3** — ảnh + tên + collection đầy đủ (`VITE_ALCHEMY_API_KEY`).
 * 2. **Backend / Etherscan `tokennfttx`** — fallback liệt kê NFT (không có metadata đầy đủ).
 * 3. **On-chain `tokenURI`** — bổ sung ảnh/tên khi dùng nguồn Etherscan.
 */

export interface NftItem {
  contract: Address;
  tokenId: string;
  name: string | null;
  collection: string | null;
  imageUrl: string | null;
  tokenType: 'ERC721' | 'ERC1155' | 'UNKNOWN';
  balance: string;
}

export type NftResult =
  | { kind: 'ok'; items: NftItem[]; source: 'alchemy' | 'etherscan'; truncated: boolean }
  | { kind: 'unavailable'; reason: string };

const ERC721_URI_ABI = [
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
] as const;

const METADATA_ENRICH_LIMIT = 50;

const ALCHEMY_NETWORK: Partial<Record<NetworkId, string>> = {
  eth_mainnet: 'eth-mainnet',
  eth_sepolia: 'eth-sepolia',
  bsc_mainnet: 'bnb-mainnet',
  polygon_mainnet: 'polygon-mainnet',
  base_mainnet: 'base-mainnet',
};

interface AlchemyNft {
  contract?: { address?: string; name?: string; openSeaMetadata?: { collectionName?: string } };
  tokenId?: string;
  name?: string;
  tokenType?: string;
  balance?: string;
  image?: { cachedUrl?: string; thumbnailUrl?: string; originalUrl?: string };
}

/** Chuyển ipfs:// sang gateway HTTP để <img> hiển thị được. */
function normalizeImage(url: string | undefined | null): string | null {
  if (!url) return null;
  if (url.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${url.slice('ipfs://'.length).replace(/^ipfs\//, '')}`;
  }
  return url.startsWith('http') ? url : null;
}

function resolveMetadataUri(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${uri.slice('ipfs://'.length).replace(/^ipfs\//, '')}`;
  }
  if (uri.startsWith('ar://')) {
    return `https://arweave.net/${uri.slice('ar://'.length)}`;
  }
  return uri;
}

async function fetchMetadataJson(uri: string): Promise<Record<string, unknown> | null> {
  try {
    if (uri.startsWith('data:application/json')) {
      const payload = uri.includes(',') ? uri.split(',').slice(1).join(',') : '';
      const json =
        uri.includes(';base64,')
          ? atob(payload)
          : decodeURIComponent(payload);
      return JSON.parse(json) as Record<string, unknown>;
    }
    const response = await fetch(resolveMetadataUri(uri));
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function metadataImage(meta: Record<string, unknown>): string | null {
  const image = meta.image ?? meta.image_url;
  if (typeof image === 'string') return normalizeImage(image);
  if (image && typeof image === 'object' && 'url' in image && typeof image.url === 'string') {
    return normalizeImage(image.url);
  }
  return null;
}

/** Bổ sung tên + ảnh bằng cách đọc tokenURI on-chain (ERC-721). */
async function enrichNftMetadata(networkId: string, items: NftItem[]): Promise<NftItem[]> {
  const targets = items.filter((item) => !item.imageUrl).slice(0, METADATA_ENRICH_LIMIT);
  if (targets.length === 0) return items;

  const client = getPublicClient(networkId);
  const uriResults = await client.multicall({
    contracts: targets.map((nft) => ({
      address: nft.contract,
      abi: ERC721_URI_ABI,
      functionName: 'tokenURI',
      args: [BigInt(nft.tokenId)],
    })),
    allowFailure: true,
  });

  const patches = new Map<string, Partial<NftItem>>();

  await Promise.all(
    targets.map(async (nft, index) => {
      const uriResult = uriResults[index];
      if (!uriResult || uriResult.status === 'failure') return;

      const meta = await fetchMetadataJson(uriResult.result as string);
      if (!meta) return;

      const key = `${nft.contract.toLowerCase()}:${nft.tokenId}`;
      patches.set(key, {
        name: typeof meta.name === 'string' ? meta.name : nft.name,
        imageUrl: metadataImage(meta),
      });
    }),
  );

  return items.map((nft) => {
    const patch = patches.get(`${nft.contract.toLowerCase()}:${nft.tokenId}`);
    if (!patch) return nft;
    return {
      ...nft,
      name: patch.name ?? nft.name,
      imageUrl: patch.imageUrl ?? nft.imageUrl,
    };
  });
}

async function fetchFromAlchemy(
  networkId: string,
  owner: Address,
  apiKey: string,
): Promise<NftResult> {
  const network = ALCHEMY_NETWORK[normalizeNetworkId(networkId)];
  if (!network) {
    return { kind: 'unavailable', reason: 'Alchemy không hỗ trợ NFT trên mạng này.' };
  }

  const url = new URL(`https://${network}.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner`);
  url.searchParams.set('owner', owner);
  url.searchParams.set('withMetadata', 'true');
  url.searchParams.set('pageSize', '100');

  const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
  if (!response.ok) {
    return {
      kind: 'unavailable',
      reason: `Alchemy trả lỗi ${response.status}. Kiểm tra VITE_ALCHEMY_API_KEY.`,
    };
  }

  const body = (await response.json()) as { ownedNfts?: AlchemyNft[]; pageKey?: string };
  const items = (body.ownedNfts ?? []).flatMap((nft): NftItem[] => {
    const contract = nft.contract?.address;
    if (!contract || !nft.tokenId) return [];
    return [
      {
        contract: getAddress(contract) as Address,
        tokenId: nft.tokenId,
        name: nft.name ?? null,
        collection: nft.contract?.openSeaMetadata?.collectionName ?? nft.contract?.name ?? null,
        imageUrl: normalizeImage(
          nft.image?.thumbnailUrl ?? nft.image?.cachedUrl ?? nft.image?.originalUrl,
        ),
        tokenType: nft.tokenType === 'ERC1155' ? 'ERC1155' : nft.tokenType === 'ERC721' ? 'ERC721' : 'UNKNOWN',
        balance: nft.balance ?? '1',
      },
    ];
  });

  return { kind: 'ok', items, source: 'alchemy', truncated: Boolean(body.pageKey) };
}

interface EtherscanNftTx {
  contractAddress: string;
  tokenID: string;
  tokenName?: string;
  tokenSymbol?: string;
  from: string;
  to: string;
}

function isNoNftTransfersMessage(message?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('no transactions') ||
    lower.includes('no record found') ||
    lower.includes('no tx found')
  );
}

function buildHeldNftsFromTransfers(
  transfers: EtherscanNftTx[],
  owner: Address,
): { items: NftItem[]; truncated: boolean } {
  const held = new Map<string, NftItem>();
  const target = getAddress(owner);

  for (const tx of transfers) {
    const key = `${tx.contractAddress.toLowerCase()}:${tx.tokenID}`;
    const receivedByOwner = getAddress(tx.to) === target;

    if (receivedByOwner) {
      held.set(key, {
        contract: getAddress(tx.contractAddress) as Address,
        tokenId: tx.tokenID,
        name: tx.tokenName ? `${tx.tokenName} #${tx.tokenID}` : null,
        collection: tx.tokenName ?? tx.tokenSymbol ?? null,
        imageUrl: null,
        tokenType: 'ERC721',
        balance: '1',
      });
    } else if (getAddress(tx.from) === target) {
      held.delete(key);
    }
  }

  return {
    items: [...held.values()],
    truncated: transfers.length >= 1000,
  };
}

function transfersFromBackend(records: NftTransferRecord[]): EtherscanNftTx[] {
  return records.map((record) => ({
    contractAddress: record.contractAddress,
    tokenID: record.tokenID,
    tokenName: record.tokenName,
    tokenSymbol: record.tokenSymbol,
    from: record.from,
    to: record.to,
  }));
}

function explorerErrorDetail(body: { status: string; message?: string; result?: unknown }): string {
  if (typeof body.result === 'string' && body.result.trim()) return body.result;
  if (typeof body.message === 'string' && body.message.trim()) return body.message;
  return '';
}

async function fetchFromBackend(walletId: string, owner: Address): Promise<NftResult | null> {
  try {
    const body = await getWalletNftTransfers(walletId);
    if (body.status !== '1' || !Array.isArray(body.result)) {
      const detail = explorerErrorDetail(body);
      if (isNoNftTransfersMessage(detail)) {
        return { kind: 'ok', items: [], source: 'etherscan', truncated: false };
      }
      return {
        kind: 'unavailable',
        reason: formatExplorerError(
          detail || 'Explorer từ chối yêu cầu — kiểm tra etherscan.api-key trên backend',
        ),
      };
    }

    const { items, truncated } = buildHeldNftsFromTransfers(
      transfersFromBackend(body.result),
      owner,
    );
    return { kind: 'ok', items, source: 'etherscan', truncated };
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 404) {
        return {
          kind: 'unavailable',
          reason: 'Backend chưa có API NFT — restart Spring Boot để tải endpoint /nfts.',
        };
      }
      return { kind: 'unavailable', reason: error.message };
    }
    return null;
  }
}

/**
 * Dựng lại quyền sở hữu từ lịch sử chuyển nhượng ERC-721.
 * Duyệt theo thứ tự thời gian: nhận vào thì thêm, chuyển đi thì bỏ.
 */
async function fetchFromEtherscan(
  networkId: string,
  owner: Address,
  apiKey?: string,
): Promise<NftResult> {
  const body = await fetchEtherscanV2<EtherscanNftTx[] | string>(
    networkId,
    {
      module: 'account',
      action: 'tokennfttx',
      address: owner,
      startblock: '0',
      endblock: 'latest',
      sort: 'asc',
      page: '1',
      offset: '1000',
    },
    apiKey,
  );
  if (!body) {
    return {
      kind: 'unavailable',
      reason:
        'Không kết nối được explorer — thêm VITE_ETHERSCAN_API_KEY vào .env.local hoặc cấu hình etherscan.api-key trên backend.',
    };
  }

  if (body.status !== '1' || !Array.isArray(body.result)) {
    const detail = typeof body.result === 'string' ? body.result : body.message;
    if (isNoNftTransfersMessage(detail) || isNoNftTransfersMessage(body.message)) {
      return { kind: 'ok', items: [], source: 'etherscan', truncated: false };
    }
    return { kind: 'unavailable', reason: formatExplorerError(detail) };
  }

  const { items, truncated } = buildHeldNftsFromTransfers(body.result, owner);
  return { kind: 'ok', items, source: 'etherscan', truncated };
}

export async function fetchNfts(params: {
  networkId: string;
  owner: Address;
  walletId?: string;
  alchemyApiKey?: string;
  etherscanApiKey?: string;
}): Promise<NftResult> {
  try {
    if (params.alchemyApiKey) {
      const alchemy = await fetchFromAlchemy(params.networkId, params.owner, params.alchemyApiKey);
      if (alchemy.kind === 'ok') return alchemy;
    }

    if (params.walletId) {
      const backend = await fetchFromBackend(params.walletId, params.owner);
      if (backend?.kind === 'ok') {
        const items = await enrichNftMetadata(params.networkId, backend.items);
        return { ...backend, items };
      }
      if (backend?.kind === 'unavailable' && !params.etherscanApiKey) {
        return backend;
      }
    }

    const etherscanResult = await fetchFromEtherscan(
      params.networkId,
      params.owner,
      params.etherscanApiKey,
    );
    if (etherscanResult.kind !== 'ok') return etherscanResult;

    const items = await enrichNftMetadata(params.networkId, etherscanResult.items);
    return { ...etherscanResult, items };
  } catch (error) {
    return {
      kind: 'unavailable',
      reason: error instanceof Error ? error.message : 'Không tải được danh sách NFT.',
    };
  }
}
