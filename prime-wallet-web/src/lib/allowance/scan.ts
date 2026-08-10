import {
  decodeAbiParameters,
  encodeFunctionData,
  getAddress,
  hexToString,
  maxUint256,
  type Address,
  type PublicClient,
} from 'viem';
import { erc20Abi, multicall3Abi } from '@/lib/dex/abis';
import { MULTICALL3_ADDRESS } from '@/lib/dex/constants';
import { ETHERSCAN_V2_API, SUPPORTS_LOG_SCAN, chainIdOf, type NetworkId } from '@/lib/wagmi/chains';
import { knownSpenderOf, knownSpendersFor } from './knownSpenders';

/**
 * Phát hiện & thu hồi quyền chi tiêu ERC-20.
 *
 * Nguồn dữ liệu ghép từ hai phía:
 * 1. Quét log `Approval` qua Etherscan V2 — thấy được cả spender lạ.
 * 2. Bảng KNOWN_SPENDERS — bù cho phần log scan bỏ sót/bị cắt trang.
 *
 * Cả hai chỉ cho biết "đã từng approve"; allowance CÒN LẠI phải đọc on-chain,
 * vì log không phản ánh phần đã tiêu hay đã revoke.
 */

/** keccak256("Approval(address,address,uint256)") */
const APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

const PAGE_SIZE = 1000;
const MAX_PAGES = 3;

export interface AllowanceEntry {
  token: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  spender: Address;
  spenderName: string | null;
  spenderDescription: string | null;
  /** Allowance còn lại, đọc on-chain. */
  amount: bigint;
  /** true khi allowance ở mức vô hạn (hoặc gần vô hạn). */
  isUnlimited: boolean;
}

export interface AllowanceScanResult {
  entries: AllowanceEntry[];
  /** true khi log scan chạm trần trang — có thể còn approve chưa liệt kê hết. */
  truncated: boolean;
  /** true khi mạng không hỗ trợ quét log (chỉ dựa vào KNOWN_SPENDERS). */
  logScanUnavailable: boolean;
}

interface EtherscanLog {
  address: string;
  topics: string[];
  data: string;
}

/** Ngưỡng coi là "vô hạn": trên 2^255 — tránh so bằng đúng maxUint256 vì nhiều token dùng 2^96-1. */
const UNLIMITED_THRESHOLD = maxUint256 / 2n;

/**
 * Quét log Approval của một chủ sở hữu.
 *
 * ERC-721 `ApprovalForAll` dùng cùng chữ ký sự kiện nhưng chỉ có 3 topic
 * (owner, operator) — lọc theo `topics.length !== 3` để chỉ giữ ERC-20.
 */
async function scanApprovalLogs(
  networkId: string,
  owner: Address,
  apiKey?: string,
): Promise<{ pairs: { token: Address; spender: Address }[]; truncated: boolean }> {
  const pairs = new Map<string, { token: Address; spender: Address }>();
  let truncated = false;

  const ownerTopic = `0x${owner.slice(2).toLowerCase().padStart(64, '0')}`;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      chainid: String(chainIdOf(networkId)),
      module: 'logs',
      action: 'getLogs',
      fromBlock: '0',
      toBlock: 'latest',
      topic0: APPROVAL_TOPIC,
      topic1: ownerTopic,
      topic0_1_opr: 'and',
      page: String(page),
      offset: String(PAGE_SIZE),
    });
    if (apiKey) params.set('apikey', apiKey);

    const response = await fetch(`${ETHERSCAN_V2_API}?${params.toString()}`);
    if (!response.ok) break;

    const body = (await response.json()) as { status: string; result: EtherscanLog[] | string };
    if (body.status !== '1' || !Array.isArray(body.result)) break;

    for (const log of body.result) {
      // ERC-721 ApprovalForAll cũng khớp topic0 — loại bằng số topic.
      if (log.topics.length !== 3) continue;
      const token = getAddress(log.address) as Address;
      const spender = getAddress(`0x${log.topics[2].slice(26)}`) as Address;
      pairs.set(`${token}:${spender}`, { token, spender });
    }

    if (body.result.length < PAGE_SIZE) break;
    if (page === MAX_PAGES) truncated = true;
  }

  return { pairs: [...pairs.values()], truncated };
}

/** Đọc allowance + metadata token của mọi cặp trong một request multicall. */
async function readAllowances(
  client: PublicClient,
  owner: Address,
  pairs: { token: Address; spender: Address }[],
): Promise<AllowanceEntry[]> {
  if (pairs.length === 0) return [];

  const calls = pairs.flatMap((pair) => [
    {
      target: pair.token,
      allowFailure: true,
      callData: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'allowance',
        args: [owner, pair.spender],
      }),
    },
    {
      target: pair.token,
      allowFailure: true,
      callData: encodeFunctionData({ abi: erc20Abi, functionName: 'symbol' }),
    },
    {
      target: pair.token,
      allowFailure: true,
      callData: encodeFunctionData({ abi: erc20Abi, functionName: 'decimals' }),
    },
  ]);

  const results = await client.readContract({
    address: MULTICALL3_ADDRESS,
    abi: multicall3Abi,
    functionName: 'aggregate3',
    args: [calls],
  });

  const entries: AllowanceEntry[] = [];
  for (let i = 0; i < pairs.length; i += 1) {
    const allowanceResult = results[i * 3];
    if (!allowanceResult?.success) continue;

    const amount = BigInt(allowanceResult.returnData);
    // Allowance đã hết hoặc đã revoke — không có gì để người dùng xử lý.
    if (amount === 0n) continue;

    const symbolResult = results[i * 3 + 1];
    const decimalsResult = results[i * 3 + 2];

    entries.push({
      token: pairs[i].token,
      tokenSymbol: decodeStringSafe(symbolResult) ?? `${pairs[i].token.slice(0, 6)}…`,
      tokenDecimals: decimalsResult?.success ? Number(BigInt(decimalsResult.returnData)) : 18,
      spender: pairs[i].spender,
      spenderName: null,
      spenderDescription: null,
      amount,
      isUnlimited: amount >= UNLIMITED_THRESHOLD,
    });
  }
  return entries;
}

/**
 * Symbol chuẩn là `string`, nhưng token đời đầu (MKR…) trả `bytes32`.
 * Thử string trước, rơi về bytes32, cuối cùng trả null.
 */
function decodeStringSafe(
  result: { success: boolean; returnData: `0x${string}` } | undefined,
): string | null {
  if (!result?.success || result.returnData.length <= 2) return null;

  try {
    const decoded = decodeAbiParameters([{ type: 'string' }], result.returnData)[0];
    const trimmed = decoded.replace(/\0/g, '').trim();
    if (trimmed) return trimmed;
  } catch {
    /* không phải string — thử bytes32 */
  }

  try {
    const raw = decodeAbiParameters([{ type: 'bytes32' }], result.returnData)[0];
    return hexToString(raw).replace(/\0/g, '').trim() || null;
  } catch {
    return null;
  }
}

export async function scanAllowances(params: {
  client: PublicClient;
  networkId: string;
  owner: Address;
  /** Token app đã biết — luôn kiểm tra với KNOWN_SPENDERS dù log scan có thấy hay không. */
  knownTokens?: Address[];
  etherscanApiKey?: string;
}): Promise<AllowanceScanResult> {
  const { client, networkId, owner } = params;
  const canScan = SUPPORTS_LOG_SCAN[networkId as NetworkId] ?? false;

  let pairs: { token: Address; spender: Address }[] = [];
  let truncated = false;

  if (canScan) {
    try {
      const scanned = await scanApprovalLogs(networkId, owner, params.etherscanApiKey);
      pairs = scanned.pairs;
      truncated = scanned.truncated;
    } catch {
      // Log scan hỏng không phải lý do để bỏ luôn KNOWN_SPENDERS.
      truncated = true;
    }
  }

  // Bù bằng bảng spender đã biết × token đã biết.
  const spenders = knownSpendersFor(networkId);
  const tokens = params.knownTokens ?? [];
  const seen = new Set(pairs.map((pair) => `${pair.token}:${pair.spender}`));
  for (const token of tokens) {
    for (const spender of spenders) {
      const key = `${getAddress(token)}:${getAddress(spender.address)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ token: getAddress(token), spender: getAddress(spender.address) });
    }
  }

  const entries = await readAllowances(client, owner, pairs);

  for (const entry of entries) {
    const known = knownSpenderOf(networkId, entry.spender);
    entry.spenderName = known?.name ?? null;
    entry.spenderDescription = known?.description ?? null;
  }

  entries.sort((a, b) => {
    if (a.isUnlimited !== b.isUnlimited) return a.isUnlimited ? -1 : 1;
    return a.tokenSymbol.localeCompare(b.tokenSymbol);
  });

  return { entries, truncated, logScanUnavailable: !canScan };
}

/** Calldata thu hồi quyền: `approve(spender, 0)`. */
export function buildRevokeCalldata(spender: Address): `0x${string}` {
  return encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, 0n] });
}
