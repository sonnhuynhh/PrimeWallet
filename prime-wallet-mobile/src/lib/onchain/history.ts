import { fetchEtherscanV2 } from "../etherscan/v2";
import { normalizeNetworkId } from "../chains";
import type { EtherscanTransaction } from "../../services/crypto";

function normalizeTxList(result: unknown): EtherscanTransaction[] {
  if (!Array.isArray(result)) return [];
  return result
    .filter((item): item is Record<string, string> => item && typeof item === "object")
    .map((item) => ({
      hash: item.hash ?? "",
      from: item.from ?? "",
      to: item.to ?? "",
      value: item.value ?? "0",
      timeStamp: item.timeStamp ?? "0",
      isError: item.isError ?? "0",
    }))
    .filter((tx) => tx.hash);
}

/** Đảm bảo result luôn là mảng — Etherscan đôi khi trả chuỗi. */
export function normalizeEtherscanResult(result: unknown): EtherscanTransaction[] {
  return normalizeTxList(result);
}

export async function fetchOnChainTransactions(
  networkId: string,
  address: string,
  apiKey?: string,
): Promise<EtherscanTransaction[]> {
  if (!apiKey) return [];

  const network = normalizeNetworkId(networkId);
  const body = await fetchEtherscanV2<unknown>(
    network,
    {
      module: "account",
      action: "txlist",
      address,
      startblock: "0",
      endblock: "99999999",
      page: "1",
      offset: "100",
      sort: "desc",
    },
    apiKey,
  );

  if (!body) return [];
  if (Array.isArray(body.result)) return normalizeTxList(body.result);

  const detail = typeof body.result === "string" ? body.result : "";
  const msg = `${body.message ?? ""} ${detail}`.toLowerCase();
  if (msg.includes("no transactions") || msg.includes("no record found") || msg.includes("no tx found")) {
    return [];
  }

  return [];
}
