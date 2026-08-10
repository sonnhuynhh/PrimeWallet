export function shortAddress(address?: string | null, head = 6, tail = 4) {
  if (!address) return "";
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export function fmtNumber(value: number | string, maximumFractionDigits = 6) {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("vi-VN", { maximumFractionDigits });
}

export function fmtVnd(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0 ₫";
  return `${n.toLocaleString("vi-VN", { maximumFractionDigits: 0 })} ₫`;
}

export function clampDecimals(value: string, decimals: number) {
  const [int, frac] = value.split(".");
  if (frac === undefined) return int;
  if (decimals === 0) return int;
  return `${int}.${frac.slice(0, decimals)}`;
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
