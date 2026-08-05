# TỔNG HỢP QUÁ TRÌNH PHÁT TRIỂN PRIME WALLET (PROJECT HISTORY)

Tài liệu này ghi chú lại toàn bộ các giai đoạn phát triển của dự án PrimeWallet, từ các quyết định kiến trúc, các vấn đề gặp phải, cho đến cách khắc phục. Tài liệu này sẽ được cập nhật liên tục khi dự án mở rộng trong tương lai.

---

## 🚀 GIAI ĐOẠN 1 & 2: Khởi tạo dự án & Module Xác thực (Auth)

### 📌 Những gì đã xây dựng
- **Cấu trúc cơ bản:** Thiết lập Spring Boot project theo chuẩn kiến trúc nguyên khối (Monolith) với mô hình Controller - Service - Repository.
- **Module Auth:** 
  - Tạo Entity `User`.
  - Tích hợp **Spring Security** và **JWT (JSON Web Token)** để bảo mật API.
  - Các tính năng: Đăng ký (Register), Đăng nhập (Login).

### 💡 Lý do & Quyết định
- **Tại sao bắt đầu với Auth?** Bảo mật là nền tảng cốt lõi của một ứng dụng tài chính. Mọi thao tác tạo ví, chuyển tiền đều cần định danh chính xác người dùng thông qua JWT token.

---

## 💰 GIAI ĐOẠN 3: Core Wallet Module (Xử lý giao dịch lõi)

### 📌 Những gì đã xây dựng
- **Entities:** `Account` (Ví), `Transaction` (Giao dịch), `LedgerEntry` (Sổ cái ghi nhận biến động số dư).
- **Tính năng giao dịch:**
  - `Top-up` (Nạp tiền).
  - `Withdraw` (Rút tiền).
  - `Transfer` (Chuyển tiền nội bộ).
- **Quy trình xử lý chuẩn:** Mỗi giao dịch đều được ghi vào bảng `transactions`, sau đó ghi vào `ledger_entries` 2 dòng (tiền ra/tiền vào đối với chuyển khoản), và cuối cùng cập nhật `balance` trong bảng `accounts`.

### ⚠️ Vấn đề gặp phải
- **Concurrency (Đồng thời):** Khi nhiều request cùng nạp/rút tiền trên một ví tại cùng một thời điểm, có nguy cơ xảy ra "Race Condition" dẫn đến số dư bị sai lệch.

### 🛠 Cách khắc phục
- Áp dụng **Pessimistic Write Lock** (Khóa bi quan) ở cấp độ Database thông qua Hibernate (`@Lock(LockModeType.PESSIMISTIC_WRITE)` trong `AccountRepository.findByIdWithLock`). 
- **Lý do:** Điều này đảm bảo rằng trong suốt quá trình một giao dịch đang tính toán số dư, các giao dịch khác trên cùng tài khoản đó phải xếp hàng chờ, bảo vệ tuyệt đối tính toàn vẹn của dữ liệu tài chính.

---

## 📡 GIAI ĐOẠN 4: Event-Driven Architecture (Kafka) & Caching (Redis)

### 📌 Những gì đã xây dựng
- **Hạ tầng (Infrastructure):** Viết `docker-compose.yml` để chạy Zookeeper, Kafka, và Redis cục bộ.
- **Redis Caching:**
  - **Cache-Aside trong `AccountService`:** Khi truy vấn số dư, hệ thống ưu tiên đọc từ Redis (cực nhanh). Nếu Cache Miss mới gọi xuống DB.
  - **Write-Through trong `LedgerService`:** Bất cứ khi nào số dư thay đổi do giao dịch, Redis Cache sẽ được cập nhật ngay lập tức.
- **Event-Driven với Kafka:**
  - Khi một giao dịch thành công trong `TransactionService`, hệ thống không trực tiếp gọi module thông báo. Thay vào đó, nó xuất (publish) một `TransactionEvent` lên topic `wallet.transactions` của Kafka.
  - Viết `NotificationConsumer` đóng vai trò là Kafka Consumer lắng nghe topic này và log ra thông báo.

### 💡 Lý do & Quyết định
- **Tại sao chuyển sang Event-Driven?** Ở dự án trước, chúng ta bàn luận về ưu điểm của Hướng sự kiện. Mặc dù PrimeWallet vẫn đang là Monolith (OOP), việc thêm tầng Event-Driven giúp **Tách rời (Decouple)** core giao dịch khỏi các tác vụ phụ (gửi email, push notification, AI fraud detection). Nếu service gửi email bị lỗi hay chậm, giao dịch chuyển tiền vẫn diễn ra mượt mà và thành công.
- **Tại sao dùng Redis?** Cải thiện tốc độ truy vấn số dư ví - API được gọi nhiều nhất trong ứng dụng ngân hàng/ví điện tử, giảm tải cho Database chính.

### ⚠️ Vấn đề gặp phải
- **Lỗi Serialization Kafka (SerializationException):** Kafka mặc định không biết cách tuần tự hóa (serialize) object `LocalDateTime` (của Java 8) sang JSON.
- Khắc phục lần 1 (Thất bại): Cố gắng tiêm `JavaTimeModule` của thư viện Jackson vào custom `ProducerFactory`. Tuy nhiên Spring DevTools bị lỗi cache class, dẫn đến lỗi Unresolved Compilation.
- Khắc phục lần 2 (Thành công): Để mọi thứ đơn giản và tương thích với mọi ngôn ngữ (Python, Node.js sau này), đã **đổi kiểu dữ liệu của trường `timestamp` trong `TransactionEvent` từ `LocalDateTime` sang `String`** chuẩn ISO. Vấn đề lập tức được giải quyết mà không cần cấu hình ObjectMapper phức tạp.
- **Lỗi Docker ngắt kết nối:** Do để máy tính nghỉ, Kafka broker trong Docker bị ngắt. Đã khắc phục bằng cách restart lại Docker Compose (`docker compose down` & `up -d`), chờ vài giây cho Kafka khởi động lại hoàn toàn trước khi chạy Spring Boot.

---

## 🛡️ GIAI ĐOẠN 5: Quản trị Người dùng & Bảo mật Nâng cao (User Management & Advanced Security)

### 📌 Những gì đã xây dựng
- **Tài khoản cá nhân (User Profile):** Các API xem thông tin cá nhân, cập nhật thông tin và đổi mật khẩu. Đã cấu hình phân quyền (Role-based access).
- **Admin Dashboard:** Các API dành riêng cho quản trị viên (Admin) để quản lý User: Cập nhật trạng thái xác minh danh tính (KYC), Khóa/Mở khóa tài khoản khi có dấu hiệu gian lận.
- **Enforcement Nghiệp vụ (Business Rules):** Ràng buộc giao dịch lớn. Bất kỳ giao dịch nạp, rút, chuyển tiền nào có giá trị lớn hơn hoặc bằng 10,000,000 VNĐ đều yêu cầu User phải hoàn thành quá trình KYC. Ném lỗi Custom (`KycRequiredException`, `AccountLockedException`) và bắt lỗi tập trung qua `GlobalExceptionHandler`.
- **Bảo vệ Hệ thống (Rate Limiting):** Sử dụng Redis để giới hạn số lượng request API theo IP của người dùng. Áp dụng 5 request/phút cho đăng nhập (chống Brute-force) và 60 request/phút cho các API khác (chống Spam/DDoS).
- **Ghi nhật ký Kiểm toán (Audit Logging):** Xây dựng hệ thống log tự động ghi nhận mọi thao tác quan trọng (đăng nhập, giao dịch, thay đổi trạng thái user) vào bảng `audit_logs`. Hệ thống log này được xử lý bất đồng bộ (`@Async`) để không làm ảnh hưởng đến hiệu năng của luồng giao dịch chính.

### 💡 Lý do & Quyết định
- **Tách biệt AdminService và AuthService:** Áp dụng nguyên lý SRP (Single Responsibility Principle). AuthService xử lý tác vụ của user tự làm, còn AdminService xử lý tác vụ của Admin tác động lên user khác.
- **Tại sao dùng Redis cho Rate Limiting?** Nếu dùng bộ nhớ RAM của Java (như HashMap), khi ứng dụng restart hoặc chạy nhiều server, biến nhớ sẽ bị mất/không đồng bộ. Redis giải quyết được cả bài toán phân tán và tự động xoá dữ liệu cũ theo thời gian (TTL).

### ⚠️ Vấn đề gặp phải
- **Lỗi kết nối Kafka trong khi chạy Test Tự Động (Unit/Integration Test):** Khi chạy lệnh `mvnw test`, bài test yêu cầu phải nạp context của Spring Boot, đồng nghĩa với việc kết nối đến Kafka và Redis. Nếu Docker chưa chạy các dịch vụ này, quá trình test sẽ gặp lỗi Timeout hoặc Connection Refused.
- **Cách khắc phục:** Luôn đảm bảo cụm Docker Compose (`docker compose up -d`) đang hoạt động trơn tru trước khi tiến hành test hoặc build ứng dụng.

## 💳 GIAI ĐOẠN 6: Tích hợp Cổng thanh toán (Payment Gateway Integration)

### 📌 Những gì đã xây dựng
- **Tích hợp VNPAY Sandbox:** Kết nối với môi trường thử nghiệm của VNPAY để giả lập việc nạp tiền từ tài khoản ngân hàng thật vào ví điện tử.
- **Tạo Link Thanh Toán (Create Payment):** Xây dựng API `POST /api/payment/vnpay/create` để tạo URL chứa các tham số thanh toán, mã hóa chữ ký bằng `HMAC-SHA512` bảo mật tuyệt đối dữ liệu.
- **Xử lý Webhook / IPN (Instant Payment Notification):**
  - Tạo API `GET /api/payment/vnpay/ipn` (và `/return` cho môi trường Local) để nhận tín hiệu thanh toán thành công từ VNPAY.
  - Tự động gọi `TransactionService.topUp()` để cộng tiền vào ví người dùng ngay khi ngân hàng báo về.
- **Tính Lũy Đẳng (Idempotency):** Áp dụng mã `TxnRef` sinh từ chuẩn `UUID` làm Idempotency Key để ngăn chặn tình trạng cộng tiền hai lần (Double-Topup) do mạng chập chờn hoặc gọi API trùng lặp.
- **Bảo mật File Cấu hình:** Đưa các thông tin nhạy cảm (TmnCode, HashSecret) vào file `application-local.properties` và loại trừ khỏi Git (qua `.gitignore`) để tránh lộ thông tin bảo mật lên repository.

### 💡 Lý do & Quyết định
- **Tại sao lại dùng VNPAY?** VNPAY là cổng thanh toán phổ biến tại Việt Nam, cung cấp môi trường Sandbox miễn phí và đầy đủ tài liệu, rất phù hợp để mô phỏng một quy trình thanh toán E-Wallet tiêu chuẩn (Server-to-Server Webhook).

### ⚠️ Vấn đề gặp phải
- **Lỗi Mismatch Kiểu Dữ Liệu (UUID vs String):** VNPAY sinh mã giao dịch (TxnRef) là chuỗi bất kỳ, nhưng hệ thống Wallet yêu cầu Idempotency Key phải là định dạng UUID. 
- Khắc phục: Chủ động sinh `UUID.randomUUID()` ngay từ khâu tạo thanh toán và gán vào TxnRef của VNPAY.
- **Lỗi Xác minh Chữ ký IPN (Checksum Failed):** Hàm Hash mặc định không tự động sắp xếp tham số theo bảng chữ cái (A-Z) và không mã hóa URL (URL Encode), dẫn đến mã băm tạo ra lệch với VNPAY.
- Khắc phục: Sửa lại `VnpayUtil.hashAllFields()` bằng cách đưa Key vào mảng `ArrayList`, gọi `Collections.sort()` và bọc giá trị qua `URLEncoder.encode()`.
- **Lỗi RequestParam Unmodifiable Map:** Spring Boot trả về danh sách param dưới dạng Map "chỉ đọc", không cho phép dùng `.remove()` để xóa trường chữ ký.
- Khắc phục: Khởi tạo một `new HashMap<>(params)` trước khi thao tác xử lý.

---

## 🔮 TƯƠNG LAI (CÁC GIAI ĐOẠN TIẾP THEO)

*(Phần này sẽ được cập nhật khi dự án tiến hành các Phase mới)*

- **Giai đoạn 7:** Đối soát và Báo cáo tự động (Cron Job & Reconciliation) - Chạy định kỳ để đối chiếu lịch sử giao dịch và tổng kết.
- **Giai đoạn 8:** Triển khai (Deployment) và CI/CD. Hoặc bắt đầu xây dựng Frontend App với React Native để giao tiếp với các API này.
