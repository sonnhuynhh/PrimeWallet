# Admin Fraud Detection + User Detail + Test Data

## Mô tả tổng quan

Thêm 3 tính năng vào hệ thống Admin Dashboard và tạo test data đầy đủ:

1. **Tab "Gian lận AI"** — hiển thị giao dịch bất thường từ AI service, risk score theo user, cho phép admin lock user
2. **User Detail Modal** — nhấn vào user trong danh sách → xem chi tiết thông tin
3. **Test Data Seeder** — Script tạo 5 users + 70+ giao dịch đa dạng để test AI

## Proposed Changes

### Component 1: Backend — API Admin cho AI Fraud Data

#### [MODIFY] [AdminController.java](file:///d:/HocCODE/Java/java_spring_boot/PrimeWallet/src/main/java/com/sonnhuynhh/primewallet/auth/controller/AdminController.java)

Thêm 2 endpoints mới:

- `GET /api/v1/admin/ai/fraud-alerts` — Lấy danh sách giao dịch bất thường từ AI (proxy qua Python)
- `GET /api/v1/admin/ai/users/{userId}/risk-score` — Lấy risk score của 1 user cụ thể

#### [MODIFY] [AdminService.java](file:///d:/HocCODE/Java/java_spring_boot/PrimeWallet/src/main/java/com/sonnhuynhh/primewallet/auth/service/AdminService.java)

Thêm methods mới gọi AI service:

- `getFraudAlerts()` — gọi AI API `/api/ai/health` + lấy transactions từ DB, kiểm tra risk
- `getUserRiskScore(userId)` — gọi AI API `/api/ai/users/{userId}/risk-score`
- `getUserAccounts(userId)` — lấy danh sách ví + số dư của 1 user

#### [MODIFY] [AiInsightService.java](file:///d:/HocCODE/Java/java_spring_boot/PrimeWallet/src/main/java/com/sonnhuynhh/primewallet/ai/service/AiInsightService.java)

Thêm method:

- `getAllUsersRiskScores(List<String> userIds)` — batch lấy risk score cho nhiều users
- `getFraudAlerts()` — gọi endpoint mới trên Python AI service

#### [MODIFY] [main.py](file:///d:/HocCODE/Java/java_spring_boot/PrimeWallet/prime-wallet-ai/main.py)

Thêm endpoint:

- `GET /api/ai/fraud-alerts` — trả danh sách users có risk score cao + giao dịch bất thường

---

### Component 2: Frontend — Tab Gian Lận AI

#### [MODIFY] [AdminDashboard.tsx](file:///d:/HocCODE/Java/java_spring_boot/PrimeWallet/prime-wallet-web/src/pages/AdminDashboard.tsx)

Thay đổi chính:

- Thêm tab `'fraud'` vào `AdminTab` type
- Thêm `TABS` entry: `{ id: 'fraud', label: 'Gian lận AI', icon: ShieldAlert }`
- Thêm state cho fraud data, user detail modal
- Render tab fraud: bảng users với risk score badge (SAFE/MEDIUM/HIGH), danh sách giao dịch bất thường, nút Lock User
- **User Detail Modal**: Khi nhấn vào 1 user ở tab Users → hiện modal chi tiết (email, phone, KYC, danh sách ví, số dư, risk score, giao dịch gần đây)

#### [MODIFY] [admin.ts](file:///d:/HocCODE/Java/java_spring_boot/PrimeWallet/prime-wallet-web/src/services/admin.ts)

Thêm API functions:

- `getAdminFraudAlerts()` — gọi `/api/v1/admin/ai/fraud-alerts`
- `getUserRiskScore(userId)` — gọi `/api/v1/admin/ai/users/{userId}/risk-score`
- `getUserDetail(userId)` — gọi `/api/v1/admin/users/{userId}` (đã có)
- `getUserAccounts(userId)` — gọi endpoint mới

---

### Component 3: Test Data Seeder Script

#### [NEW] [test_data_seeder.ps1](file:///d:/HocCODE/Java/java_spring_boot/PrimeWallet/test_data_seeder.ps1)

Script PowerShell tự động tạo test data bằng cách gọi API:

**5 Users:**

| # | Email | Password | Vai trò trong test |
|---|---|---|---|
| 1 | `nguyen.van.a@test.com` | `Test@123` | User bình thường — giao dịch ít, chi tiêu đa dạng |
| 2 | `tran.thi.b@test.com` | `Test@123` | User thường xuyên — nhiều giao dịch, nhiều danh mục |
| 3 | `le.van.c@test.com` | `Test@123` | User khả nghi — giao dịch lớn bất thường, lặp nhanh |
| 4 | `pham.hoang.d@test.com` | `Test@123` | User rất đáng ngờ — giao dịch >50 triệu, lúc 3h sáng |
| 5 | `vo.minh.e@test.com` | `Test@123` | User mới — ít giao dịch, baseline cho AI |

**70+ Giao dịch bao gồm:**
- Nạp tiền (TOPUP) với mô tả: "Nạp tiền lương", "Nạp từ VietcomBank"
- Chuyển khoản (TRANSFER) giữa các user với mô tả: "Tiền ăn trưa", "Mua shopee", "Thanh toán tiền điện", "Học phí khóa học"
- Giao dịch bình thường: ban ngày, số tiền nhỏ-vừa, cách nhau vài giờ
- Giao dịch đáng ngờ: ban đêm (3h sáng), số tiền >50 triệu, nhiều giao dịch trong 1 phút
- Mô tả đa dạng để AI phân loại danh mục: FOOD, BILL, SHOPPING, TRANSFER, ENTERTAINMENT, TRANSPORT, HEALTH, EDUCATION, CRYPTO, INCOME

> [!IMPORTANT]
> Script gọi trực tiếp API backend (`http://localhost:8080`). Cần chạy backend + Kafka + PostgreSQL trước khi chạy script.

---

## Open Questions

> [!NOTE]
> **AI service endpoint**: Hiện tại AI service không có endpoint `/api/ai/fraud-alerts` chuyên biệt cho admin. Tôi sẽ thêm endpoint mới vào Python AI service trả về danh sách tất cả users kèm risk score + giao dịch bất thường. Có đồng ý không?

---

## Verification Plan

### Automated Tests
- Chạy `./mvnw test` đảm bảo không break tests hiện có

### Manual Verification
1. Chạy `docker compose up -d` → start infra
2. Chạy Java backend + Python AI service
3. Chạy `test_data_seeder.ps1` → tạo users + giao dịch
4. Đợi AI retrain (50 events hoặc gọi manual train)
5. Login admin (`admin@primewallet.com` / `admin123`)
6. Kiểm tra tab "Báo cáo gian lận" / "Gian lận AI" hiển thị risk scores
7. Nhấn vào user trong tab "Người dùng" → kiểm tra modal chi tiết
8. Lock user đáng ngờ từ tab fraud → verify user bị khóa

---

## Trạng thái triển khai (2026-08-12)

- [x] Tab Báo cáo gian lận AI (đã có từ trước + enrich)
- [x] User Detail Modal — `GET /api/v1/admin/users/{id}/detail` + modal AdminDashboard
- [x] Test Data Seeder — `test_data_seeder.ps1` (5 users + 70+ giao dịch)