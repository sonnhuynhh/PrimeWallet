import { ethers } from "ethers";

import { fetchEtherscanV2 } from "../etherscan/v2";
import { normalizeNetworkId, rpcOf, SUPPORTS_LOG_SCAN, type NetworkId } from "../chains";
import { knownSpenderOf, knownSpendersFor } from "./knownSpenders";

const APPROVAL_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
const UNLIMITED_THRESHOLD = ethers.MaxUint256 / 2n;

export interface AllowanceEntry {
  token: string;
  tokenSymbol: string;
  tokenDecimals: number;
  spender: string;
  spenderName: string | null;
  spenderDescription: string | null;
  amount: bigint;
  isUnlimited: boolean;
}

export interface AllowanceScanResult {
  entries: AllowanceEntry[];
  truncated: boolean;
  logScanUnavailable: boolean;
}

interface EtherscanLog {
  address: string;
  topics: string[];
}

async function scanApprovalLogs(networkId: string, owner: string, apiKey?: string) {
  const pairs = new Map<string, { token: string; spender: string }>();
  const ownerTopic = `0x${owner.slice(2).toLowerCase().padStart(64, "0")}`;

  for (let page = 1; page <= 3; page += 1) {
    const body = await fetchEtherscanV2<EtherscanLog[] | string>(
      networkId,
      {
        module: "logs",
        action: "getLogs",
        fromBlock: "0",
        toBlock: "latest",
        topic0: APPROVAL_TOPIC,
        topic1: ownerTopic,
        topic0_1_opr: "and",
        page: String(page),
        offset: "1000",
      },
      apiKey,
    );
    if (!body || body.status !== "1" || !Array.isArray(body.result)) break;

    for (const log of body.result) {
      if (log.topics.length !== 3) continue;
      const token = ethers.getAddress(log.address);
      const spender = ethers.getAddress(`0x${log.topics[2].slice(26)}`);
      pairs.set(`${token}:${spender}`, { token, spender });
    }
    if (body.result.length < 1000) break;
  }

  return [...pairs.values()];
}

async function readPair(
  networkId: string,
  owner: string,
  token: string,
  spender: string,
): Promise<AllowanceEntry | null> {
  const provider = new ethers.JsonRpcProvider(rpcOf(networkId));
  const contract = new ethers.Contract(
    token,
    [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
    ],
    provider,
  );

  try {
    const [amount, symbol, decimals] = await Promise.all([
      contract.allowance(owner, spender) as Promise<bigint>,
      contract.symbol().catch(() => "TOKEN"),
      contract.decimals().catch(() => 18),
    ]);
    if (amount === 0n) return null;

    const known = knownSpenderOf(networkId, spender);
    return {
      token,
      tokenSymbol: String(symbol),
      tokenDecimals: Number(decimals),
      spender,
      spenderName: known?.name ?? null,
      spenderDescription: known?.description ?? null,
      amount,
      isUnlimited: amount >= UNLIMITED_THRESHOLD,
    };
  } catch {
    return null;
  }
}

export async function scanAllowances(params: {
  networkId: string;
  owner: string;
  knownTokens?: string[];
  etherscanApiKey?: string;
}): Promise<AllowanceScanResult> {
  const networkId = normalizeNetworkId(params.networkId);
  const canScan = SUPPORTS_LOG_SCAN[networkId as NetworkId] ?? false;

  let pairs: { token: string; spender: string }[] = [];
  if (canScan && params.etherscanApiKey) {
    try {
      pairs = await scanApprovalLogs(networkId, params.owner, params.etherscanApiKey);
    } catch {
      /* fallback KNOWN_SPENDERS */
    }
  }

  const spenders = knownSpendersFor(networkId);
  const tokens = params.knownTokens ?? [];
  const seen = new Set(pairs.map((p) => `${p.token}:${p.spender}`));
  for (const token of tokens) {
    for (const spender of spenders) {
      const key = `${ethers.getAddress(token)}:${ethers.getAddress(spender.address)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ token: ethers.getAddress(token), spender: ethers.getAddress(spender.address) });
    }
  }

  const entries: AllowanceEntry[] = [];
  for (const pair of pairs.slice(0, 40)) {
    const entry = await readPair(networkId, params.owner, pair.token, pair.spender);
    if (entry) entries.push(entry);
  }

  entries.sort((a, b) => {
    if (a.isUnlimited !== b.isUnlimited) return a.isUnlimited ? -1 : 1;
    return a.tokenSymbol.localeCompare(b.tokenSymbol);
  });

  return { entries, truncated: pairs.length > 40, logScanUnavailable: !canScan };
}

export { buildRevokeCalldata } from "../dex/approval";
