/**
 * Lưu seed phrase trong phiên trình duyệt (sessionStorage + memory).
 *
 * - Seed / private key KHÔNG gửi lên server.
 * - sessionStorage giữ seed khi refresh trang trong cùng tab — chỉ nhập một lần
 *   rồi swap/gửi không hỏi lại cho đến khi đóng tab.
 * - Đóng tab → sessionStorage xoá → phải nhập lại (non-custodial).
 */

const STORAGE_KEY = 'pw_session_seeds';

function loadFromStorage(): Map<string, string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, string>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function persist(map: Map<string, string>): void {
  try {
    if (map.size === 0) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(map)));
  } catch {
    // sessionStorage đầy hoặc bị chặn — vẫn giữ trong memory.
  }
}

/** Map địa chỉ (lowercase) → seed phrase đang mở khóa trong phiên này. */
const sessionSeeds = loadFromStorage();

export function setSessionSeed(address: string, seed: string): void {
  sessionSeeds.set(address.toLowerCase(), seed);
  persist(sessionSeeds);
}

export function getSessionSeed(address: string): string | null {
  return sessionSeeds.get(address.toLowerCase()) ?? null;
}

export function clearSessionSeed(address?: string): void {
  if (address) sessionSeeds.delete(address.toLowerCase());
  else sessionSeeds.clear();
  persist(sessionSeeds);
}

export function isSessionUnlocked(address: string): boolean {
  return sessionSeeds.has(address.toLowerCase());
}
