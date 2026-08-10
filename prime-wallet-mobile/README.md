# Prime Wallet Mobile

Frontend React Native (Expo) — đồng bộ UI với `prime-wallet-web`.

## Chạy nhanh

```bash
cd prime-wallet-mobile
npm install
npm run start
```

Backend Spring Boot phải chạy trên port **8080**.

---

## Kết nối backend từ điện thoại (tunnel)

Expo `--tunnel` chỉ tunnel **Metro bundler** (JS bundle), **không** tunnel backend API.
Cần cấu hình riêng URL backend:

### Cách 1 — Cùng WiFi (đơn giản nhất)

```bash
npm run dev:api-url   # in IP LAN gợi ý
```

Tạo file `.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:8080
```

### Cách 2 — Android Emulator

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080
```

### Cách 3 — iOS Simulator

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080
```

### Cách 4 — Ngrok tunnel (điện thoại bất kỳ mạng / 4G)

**Terminal 1** — backend:

```bash
cd .. && ./mvnw.cmd spring-boot:run
```

**Terminal 2** — mở tunnel API (tự ghi `.env`):

```bash
npm run tunnel:backend
```

**Terminal 3** — Expo tunnel (tải bundle qua internet):

```bash
npm run start:tunnel
```

Quét QR bằng Expo Go. App sẽ gọi backend qua URL ngrok trong `.env`.

> Token ngrok (miễn phí): https://dashboard.ngrok.com → thêm `NGROK_AUTHTOKEN` vào `.env`

---

## Cấu trúc UI (đồng bộ web)

| Web route | Mobile screen |
|-----------|---------------|
| `/wallet-type` | `WalletTypeScreen` |
| `/fiat` | `FiatShellScreen` (3 tab) |
| `/crypto` | `CryptoShellScreen` (9 tab — đang port) |
| `/admin` | `AdminScreen` (đang port) |

Design tokens: `src/theme/tokens.ts` (pink crypto / mint fiat — giống web `index.css`).

---

## Scripts

| Lệnh | Mô tả |
|------|--------|
| `npm start` | Expo dev server |
| `npm run start:tunnel` | Expo + tunnel bundle (Expo Go xa mạng) |
| `npm run tunnel:backend` | Ngrok tunnel port 8080 → ghi `.env` |
| `npm run dev:api-url` | In URL API theo platform |

---

## Lộ trình port từ web

- [x] Design tokens + WalletLayout
- [x] Wallet type picker + routing (lưu lựa chọn ví)
- [x] Fiat shell — nạp VNPAY, chuyển tiền, hóa đơn, AI insights, profile edit
- [x] Crypto 9 tab — Assets, Swap (LI.FI), Bridge, Gửi, Nhận, Lịch sử, NFT, Allowances, Ví
- [x] Network switcher — 5 mạng EVM (in-app wallet)
- [x] Admin dashboard
- [x] VNPAY return deep link (`primewallet://vnpay-return`)
- [ ] WalletConnect / ví ngoài (OKX, MetaMask) — web-only qua wagmi
- [ ] Sepolia Uniswap V3 engine native (mobile dùng LI.FI; fallback web engine)

### API keys (tùy chọn, `.env`)

```
EXPO_PUBLIC_ALCHEMY_API_KEY=...      # NFT gallery đầy đủ
EXPO_PUBLIC_ETHERSCAN_API_KEY=...    # NFT fallback, allowance scan
```
