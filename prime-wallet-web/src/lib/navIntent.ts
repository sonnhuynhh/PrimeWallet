/**
 * Ý định điều hướng giữa các trang — dùng cho bảng lệnh ⌘K.
 *
 * Bảng lệnh cần mở /crypto ở đúng tab, nhưng tab không nằm trên URL (shell giữ
 * state nội bộ). Thay vì đưa tab lên router, ta để lại một "ý định" dùng một lần
 * ở module scope; CryptoShell đọc và xoá ngay khi mount.
 *
 * Khi người dùng đã ở sẵn /crypto thì shell không mount lại, nên ngoài ý định
 * "để dành" còn có kênh phát tin cho các shell đang sống.
 *
 * Module scope là đủ vì cả hai phía nằm trong cùng một document; không cần
 * (và cố ý không) ghi ra storage để reload không nhảy tab bất ngờ.
 */

export type CryptoTabId =
  | 'assets' | 'swap' | 'bridge' | 'send' | 'receive'
  | 'history' | 'nft' | 'allowances' | 'wallet';

let pendingCryptoTab: CryptoTabId | null = null;
const listeners = new Set<(tab: CryptoTabId) => void>();

export function setCryptoTabIntent(tab: CryptoTabId) {
  // Shell đang mount sẽ nhận trực tiếp; nếu chưa có ai nghe thì để lại cho lần mount tới.
  if (listeners.size > 0) {
    listeners.forEach((fn) => fn(tab));
    return;
  }
  pendingCryptoTab = tab;
}

/** Đọc và xoá ý định — gọi nhiều lần chỉ lần đầu có giá trị. */
export function takeCryptoTabIntent(): CryptoTabId | null {
  const tab = pendingCryptoTab;
  pendingCryptoTab = null;
  return tab;
}

/** Đăng ký nhận ý định khi shell đã mount sẵn. Trả về hàm huỷ đăng ký. */
export function onCryptoTabIntent(fn: (tab: CryptoTabId) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
