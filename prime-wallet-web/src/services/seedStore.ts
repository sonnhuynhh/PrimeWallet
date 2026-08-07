/**
 * Lưu trữ SEED PHRASE CHỈ TRONG PHIÊN (in-memory) — non-custodial.
 *
 * Nguyên tắc bảo mật:
 * - Seed phrase / private key KHÔNG BAO GIỜ lưu vào localStorage / IndexedDB / cookie.
 * - KHÔNG gửi lên server — server chỉ xác minh bằng chữ ký (ownership).
 * - Module-scope lưu theo Map<address, seed> — chết khi đóng tab/refresh.
 *   → user phải nhập lại seed MỖI PHIÊN (đúng lựa chọn "yêu cầu nhập lại mỗi phiên").
 *
 * Index theo địa chỉ vì mỗi ví có thể có seed riêng (ví A ≠ seed ví B).
 */

/** Map địa chỉ (lowercase) → seed phrase đang mở khóa trong phiên này. */
const sessionSeeds = new Map<string, string>();

export function setSessionSeed(address: string, seed: string): void {
  sessionSeeds.set(address.toLowerCase(), seed);
}

/** Trả seed của địa chỉ (null nếu chưa mở khóa trong phiên) và KIỂM TRA địa chỉ khớp. */
export function getSessionSeed(address: string): string | null {
  return sessionSeeds.get(address.toLowerCase()) ?? null;
}

export function clearSessionSeed(address?: string): void {
  if (address) sessionSeeds.delete(address.toLowerCase());
  else sessionSeeds.clear();
}

/** Đã mở khóa địa chỉ này trong phiên chưa? */
export function isSessionUnlocked(address: string): boolean {
  return sessionSeeds.has(address.toLowerCase());
}