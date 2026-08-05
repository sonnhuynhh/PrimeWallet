# Prime Wallet Mobile

Frontend React Native cho Prime Wallet, scaffold bằng Expo, TypeScript và NativeWind.

## Mục tiêu giai đoạn đầu

- Dựng nền tảng đa nền tảng cho Android, iOS và Web.
- Kết nối đúng hợp đồng API backend hiện có.
- Giữ frontend tách biệt để không ảnh hưởng logic Spring Boot đang phát triển.

## Cấu trúc backend đã xác nhận

- Auth: `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/profile`, `/api/v1/auth/change-password`
- Wallet: `/api/v1/accounts`, `/api/v1/accounts/me`, `/api/v1/transactions/top-up`, `/api/v1/transactions/withdraw`, `/api/v1/transactions/transfer`, `/api/v1/transactions/history/{accountId}`
- Admin: `/api/v1/admin/users`

## Lưu ý tích hợp

- Backend đang chạy `8080`.
- Android emulator thường dùng `http://10.0.2.2:8080`.
- iOS simulator có thể dùng `http://localhost:8080`.
- Máy thật cần dùng IP LAN của máy dev.
- Web build có thể cần backend bật CORS.

## Chạy dự án

1. Cài dependencies.
2. Chạy `npm run start`.
3. Chọn nền tảng `android`, `ios`, hoặc `web`.
