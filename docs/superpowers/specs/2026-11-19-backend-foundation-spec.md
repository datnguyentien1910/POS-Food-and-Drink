# RestoDash POS — Backend Foundation Spec (Phase 1)

Ngày: 2026-11-19  
Trạng thái: **đã chốt — chờ triển khai**  
Phạm vi: backend local, **không thay đổi frontend**  
Plan: `docs/superpowers/plans/2026-11-19-backend-foundation-plan.md`  
Liên quan: `PROJECT.md`, `src/types.ts`, `src/config.ts`, `src/data/menu.ts`, `src/data/tables.ts`

---

## 1. Bối cảnh và mục tiêu

Frontend POS v1 đã hoàn thành, chạy thật bằng localStorage. Phase 1 xây nền tảng backend độc lập để sau này thay lớp lưu trữ local bằng API, nhưng **chưa nối frontend** trong phase này.

Mục tiêu:

- Có PostgreSQL + NestJS chạy local bằng Docker, không cần VPS/cloud.
- Có schema, migration, seed và API đủ để vận hành đơn hàng cơ bản.
- Có auth nhân viên bằng email/password và PIN, gắn với thiết bị POS.
- Có phân quyền Owner/Manager/Cashier.
- Có audit log cho thao tác nhạy cảm.
- Có Swagger để test local không cần frontend.
- Có test tự động và CI.
- Không làm hỏng frontend hiện tại; 113 test frontend vẫn pass.

---

## 2. Quyết định đã chốt

| ID | Quyết định |
| --- | --- |
| D-01 | Backend-only trong Phase 1; frontend giữ nguyên localStorage |
| D-02 | NestJS 12.5 + Express 5 |
| D-03 | PostgreSQL 17 Alpine chạy bằng Docker Compose |
| D-04 | Prisma 7.10.1 + `@prisma/adapter-pg`; không dùng Prisma 8 RC |
| D-05 | Session auth native: Passport local + `express-session` + `connect-pg-simple` + Argon2id |
| D-06 | API prefix `/api/v1`; Swagger tại `/api/docs` |
| D-07 | Response envelope `{ data, meta? }`; lỗi `{ error: { code, message, details? } }` |
| D-08 | Role: `OWNER`, `MANAGER`, `CASHIER` |
| D-09 | Đăng nhập email/password session 30 ngày rolling |
| D-10 | PIN 4 số, chọn nhân viên + PIN, session 12 giờ tuyệt đối |
| D-11 | PIN bắt buộc dùng trên thiết bị đã đăng ký |
| D-12 | PIN không khóa tài khoản, không rate limit; chỉ ghi audit |
| D-13 | Nhân viên tự đổi PIN sau khi đăng nhập; chưa có owner reset |
| D-14 | Thiết bị do Owner/Manager đăng ký sau khi đăng nhập email/password; có thu hồi |
| D-15 | Menu và bàn chỉ đọc trong Phase 1 |
| D-16 | Đơn chỉ có `COMPLETED` và `VOIDED` |
| D-17 | Một payment cho mỗi đơn trong Phase 1; schema cho phép mở rộng |
| D-18 | Server đọc giá menu và tự tính tiền; không nhận giá/tổng từ client |
| D-19 | VAT 8% tính trên tạm tính sau giảm giá; tiền VND số nguyên |
| D-20 | Audit log có API đọc cho Owner/Manager |
| D-21 | Seed 16 món, 12 bàn, 3 tài khoản mẫu |
| D-22 | Merge PR #1 trước; làm backend trên nhánh `feat/backend-foundation` |
| D-23 | Server dùng TypeScript 6.0.3; local Node 26, CI Node 24 LTS |
| D-24 | Test bằng Jest + Supertest + PostgreSQL test DB; CI dùng Postgres service |

---

## 3. Phạm vi

### 3.1 Trong phạm vi

- Docker Compose cho PostgreSQL và database test.
- NestJS app trong `server/`, cấu hình env có validate.
- Prisma schema, migration, seed.
- Auth email/password, PIN, session, device cookie.
- Phân quyền Owner/Manager/Cashier.
- API đọc menu/bàn.
- API tạo/xem/danh sách/huỷ đơn; payment; idempotency.
- Audit log ghi và đọc.
- Health check.
- Swagger + file `.http` mẫu.
- Unit test, E2E test, CI.
- Backup/restore bằng `pg_dump`/`pg_restore`.
- Tài liệu `server/README.md`.

### 3.2 Ngoài phạm vi

- Mọi thay đổi `src/` frontend.
- Router, service layer, login UI, offline outbox.
- Batch sync `/sync`, import localStorage.
- CRUD menu, CRUD nhân viên, ca làm.
- Trạng thái bàn, sơ đồ bàn, đặt bàn.
- Báo cáo, chi phí, khách hàng.
- Thanh toán thật (VietQR, máy quẹt thẻ), ESC/POS.
- Deploy VPS/cloud, HTTPS production.

### 3.3 Nguyên tắc

- Không sửa frontend đang chạy thật.
- Không fake dữ liệu vận hành.
- Không lưu secret trong repo.
- Không dùng số thực cho tiền.
- Mọi thao tác nhạy cảm phải có audit.
- API phải đủ rõ để Phase 2 nối frontend mà không phải đổi schema lớn.

---

## 4. Kiến trúc

```text
┌─────────────────────────────┐
│  Frontend hiện tại (không đổi) │
│  React + localStorage        │
└─────────────────────────────┘
              │ Phase 2 mới nối
              ▼
┌─────────────────────────────┐
│  NestJS API :3001            │
│  /api/v1/*  ·  /api/docs     │
│  Session + Device + RBAC     │
└──────────────┬──────────────┘
               │ Prisma 7 + pg adapter
               ▼
┌─────────────────────────────┐
│  PostgreSQL 17 (Docker)      │
│  volume pgdata               │
└─────────────────────────────┘
```

- Một API process, một database.
- Không microservices, không queue, không Redis trong Phase 1.
- Swagger là giao diện kiểm thử local.
- Frontend không gọi API trong Phase 1.

---

## 5. Cấu trúc repo

Giữ `server/` standalone, không thêm workspace vào root để tránh đụng `package.json`/`package-lock.json` của PR #1.

```text
server/
├─ src/
│  ├─ main.ts
│  ├─ app.module.ts
│  ├─ common/
│  │  ├─ decorators/       # Public, Roles, CurrentUser, CurrentDevice
│  │  ├─ filters/          # HttpExceptionFilter
│  │  ├─ guards/           # SessionAuthGuard, RolesGuard, DeviceGuard, PasswordSessionGuard
│  │  ├─ middleware/       # request-id, origin-check
│  │  ├─ security/         # hash password/PIN
│  │  └─ types/            # ApiResponse, PaginationMeta
│  ├─ config/              # env validation
│  ├─ prisma/              # PrismaModule, PrismaService
│  ├─ auth/                # email login, PIN login, session, PIN change
│  ├─ devices/             # register/list/revoke
│  ├─ menu/
│  ├─ tables/
│  ├─ orders/
│  │  ├─ money.ts
│  │  └─ order-code.service.ts
│  ├─ audit/
│  ├─ health/
│  └─ generated/prisma/    # generated client, gitignore
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  ├─ seed.ts
│  └─ seed-data.ts
├─ test/
│  ├─ auth.e2e-spec.ts
│  ├─ devices.e2e-spec.ts
│  ├─ orders.e2e-spec.ts
│  ├─ audit.e2e-spec.ts
│  ├─ health.e2e-spec.ts
│  └─ helpers/
├─ docker/
│  └─ init/01-create-test-db.sql
├─ docs/
│  └─ api.http
├─ docker-compose.yml
├─ Makefile
├─ .env.example
├─ .gitignore
├─ package.json
├─ tsconfig.json
├─ nest-cli.json
└─ README.md
```

CI workflows đặt ở root:

```text
.github/workflows/server.yml
.github/workflows/web.yml
```

---

## 6. Môi trường và chạy local

### 6.1 Yêu cầu

- Arch Linux (máy hiện tại).
- Docker + Docker Compose.
- Node 26.13.1 local; Node 24 LTS trên CI.
- npm.

### 6.2 Cài Docker

```bash
sudo pacman -S --needed docker docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
# logout/login hoặc:
newgrp docker
docker run --rm hello-world
docker compose version
```

### 6.3 Biến môi trường

`server/.env.example`:

```env
NODE_ENV=development
PORT=3001

POSTGRES_USER=restodash
POSTGRES_PASSWORD=change-me
POSTGRES_DB=restodash

DATABASE_URL=postgresql://restodash:change-me@localhost:5432/restodash?schema=public
TEST_DATABASE_URL=postgresql://restodash:change-me@localhost:5432/restodash_test?schema=public

SESSION_SECRET=change-me-32-bytes
PIN_PEPPER=change-me-32-bytes

CORS_ORIGINS=http://localhost:5173
SWAGGER_ENABLED=true
```

- `SESSION_SECRET` và `PIN_PEPPER` sinh bằng `openssl rand -hex 32`.
- Không commit `.env`.
- `POSTGRES_PASSWORD` phải khớp `DATABASE_URL`.
- Password nên dùng ký tự an toàn URL hoặc URL-encode.

### 6.4 Chạy

```bash
cd server
cp .env.example .env
# sửa secret/password
docker compose up -d db
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run start:dev
```

- API: `http://localhost:3001/api/v1`
- Swagger: `http://localhost:3001/api/docs`
- Postgres chỉ bind `127.0.0.1:5432`.

### 6.5 Test

```bash
npm test           # unit
npm run test:e2e   # e2e, dùng restodash_test
npm run lint
npm run build
```

Database test `restodash_test` được tạo bởi `docker/init/01-create-test-db.sql` khi volume mới. Nếu volume đã tồn tại, tạo tay:

```bash
docker compose exec db createdb -U restodash restodash_test
```

---

## 7. Domain model

### 7.1 Enums

```text
Role            OWNER | MANAGER | CASHIER
OrderStatus     COMPLETED | VOIDED
PaymentMethod   CASH | TRANSFER | CARD
PaymentStatus   COMPLETED | VOIDED
DiscountType    AMOUNT | PERCENT
AuditAction     AUTH_LOGIN_SUCCESS | AUTH_LOGIN_FAILED
                PIN_LOGIN_SUCCESS | PIN_LOGIN_FAILED
                PIN_CHANGED
                DEVICE_REGISTERED | DEVICE_REVOKED
                ORDER_CREATED | ORDER_VOIDED
```

### 7.2 Models

| Model | Trường chính | Ghi chú |
| --- | --- | --- |
| `Restaurant` | `id`, `slug`, `name`, `address?`, `phone?`, `taxRateBps`, `currency`, `timezone` | `slug` unique; seed `restodash`; `taxRateBps=800` |
| `User` | `id`, `email` unique, `name`, `passwordHash`, `pinHash?`, `active` | PIN có thể null |
| `Membership` | `id`, `restaurantId`, `userId`, `role` | unique `(restaurantId, userId)` |
| `Session` | `sid`, `sess`, `expire` | map bảng `session` cho `connect-pg-simple` |
| `Device` | `id`, `restaurantId`, `name`, `tokenHash` unique, `registeredById`, `lastSeenAt?`, `revokedAt?` | token hash SHA-256 |
| `Category` | `id`, `restaurantId`, `name`, `sortOrder` | unique `(restaurantId, name)` |
| `MenuItem` | `id`, `restaurantId`, `categoryId`, `legacyId?`, `name`, `description?`, `price`, `imageKey?`, `available`, `popular`, `sortOrder` | `legacyId` unique theo restaurant |
| `Table` | `id`, `restaurantId`, `legacyId?`, `name`, `seats`, `zone?` | `legacyId` unique theo restaurant |
| `Order` | `id`, `restaurantId`, `code`, `clientId?`, `tableId?`, `tableName`, `status`, `subtotal`, `discountType`, `discountValue`, `discountAmount`, `tax`, `total`, `note`, `cashierId`, `cashierName`, `createdAt`, `voidedAt?`, `voidReason?` | `code` unique theo restaurant; `clientId` unique theo restaurant |
| `OrderItem` | `id`, `orderId`, `menuItemId?`, `name`, `unitPrice`, `qty`, `note` | snapshot tên/giá |
| `Payment` | `id`, `orderId` unique, `method`, `amount`, `received?`, `change?`, `status`, `reference?` | một payment/đơn |
| `AuditLog` | `id`, `restaurantId`, `actorId?`, `deviceId?`, `action`, `entity?`, `entityId?`, `before?`, `after?`, `ip?`, `userAgent?`, `createdAt` | JSON cho before/after |
| `IdempotencyKey` | `id`, `restaurantId`, `key`, `endpoint`, `requestHash`, `statusCode`, `responseJson`, `createdAt` | unique `(restaurantId, endpoint, key)` |
| `OrderCounter` | `restaurantId`, `businessDate` (`YYYYMMDD`), `lastNumber` | composite id |

### 7.3 Quy ước dữ liệu

- Tiền là `Int` VND; không dùng float.
- `taxRateBps` là `Int` basis points; 8% = `800`.
- Ngày giờ lưu UTC (`timestamptz`); business date tính theo `Restaurant.timezone`.
- `OrderItem` là snapshot; sửa menu không làm đổi đơn cũ.
- `Order.code` format `HD-YYYYMMDD-NNN`.
- `legacyId` giữ mapping với frontend: `ga-nuong`, `ban-1`, ...
- `imageKey` giữ tên asset, không serve ảnh trong Phase 1.
- `Order.clientId` và `deviceId` (trong audit/session) chuẩn bị cho offline sync Phase 2.

### 7.4 Index chính

- `Order(restaurantId, createdAt)`
- `Order(restaurantId, status)`
- `AuditLog(restaurantId, createdAt)`
- `AuditLog(restaurantId, action, createdAt)`
- `Device(restaurantId, revokedAt)`
- `Session(expire)`
- `IdempotencyKey(createdAt)` (dọn định kỳ sau này)

---

## 8. Auth, device và PIN

### 8.1 Session

- Cookie: `restodash.sid`, `httpOnly`, `sameSite=lax`, `secure` khi production.
- Email/password: 30 ngày, rolling.
- PIN: 12 giờ tuyệt đối.
- Store: PostgreSQL qua `connect-pg-simple`, bảng `session` do Prisma migration tạo.
- `req.session.regenerate()` trước khi login.
- Logout: `req.logout()` + `req.session.destroy()` + clear cookie.
- Session chứa `userId`, `authMethod` (`password` | `pin`), `deviceId?`.

### 8.2 Đăng nhập email/password

- `POST /api/v1/auth/login`
- Body: `{ email, password }`
- Verify Argon2id; user phải `active` và có membership.
- Rate limit 5 lần/phút/IP (chỉ route này).
- Audit `AUTH_LOGIN_SUCCESS` / `AUTH_LOGIN_FAILED`.
- Trả user + role + `authMethod`, set cookie.

### 8.3 Đăng ký thiết bị

- Chỉ session `authMethod=password` + role Owner/Manager.
- `POST /api/v1/devices` body `{ name }`.
- Server sinh token 32 byte, lưu SHA-256 hash, set cookie `restodash.device` (httpOnly, 1 năm).
- `GET /api/v1/devices`: danh sách thiết bị, không trả token/hash.
- `DELETE /api/v1/devices/:id`: set `revokedAt`, xoá session PIN có `deviceId` tương ứng, audit `DEVICE_REVOKED`.
- Thiết bị bị thu hồi không dùng được staff list/PIN login.

### 8.4 Chọn nhân viên + PIN

- `GET /api/v1/auth/staff` yêu cầu device cookie; trả user active có `pinHash`, cùng restaurant: `{ id, name, role }`.
- `POST /api/v1/auth/pin` body `{ userId, pin }` + device cookie.
- Server kiểm tra device chưa thu hồi, user active, membership đúng restaurant, PIN hash.
- Thành công: session 12 giờ, `authMethod=pin`, `deviceId`, set cookie; audit `PIN_LOGIN_SUCCESS`.
- Thất bại: audit `PIN_LOGIN_FAILED`; trả 401 generic.
- **Không khóa tài khoản, không rate limit PIN** theo quyết định D-12.
- PIN 4 số: `^[0-9]{4}$`.

### 8.5 Đổi PIN

- `POST /api/v1/auth/pin/change` yêu cầu session.
- Body `{ currentPin, newPin }`.
- Verify current PIN; hash PIN mới bằng Argon2id + `PIN_PEPPER`.
- Audit `PIN_CHANGED`.
- Xoá các session PIN khác của cùng user; giữ session hiện tại.
- Chưa có owner reset PIN; PIN quên cần xử lý DB (giới hạn Phase 1).

### 8.6 Phân quyền

| Hành động | OWNER | MANAGER | CASHIER |
| --- | --- | --- | --- |
| Đăng nhập email/PIN | Có | Có | Có |
| Đăng ký/thu hồi thiết bị | Có | Có | Không |
| Xem menu/bàn | Có | Có | Có |
| Tạo đơn/thanh toán | Có | Có | Có |
| Xem danh sách/chi tiết đơn | Có | Có | Có |
| Huỷ đơn | Có | Có | Không |
| Xem audit | Có | Có | Không |

Guard mặc định chặn toàn bộ route; `@Public()` cho health/login/PIN/staff list (staff list vẫn qua `DeviceGuard`).

---

## 9. Luồng đơn hàng

### 9.1 Tạo đơn

`POST /api/v1/orders` + header `Idempotency-Key` bắt buộc.

Body:

```json
{
  "tableId": "uuid-hoặc-null",
  "items": [
    { "menuItemId": "uuid", "qty": 2, "note": "ít cay" }
  ],
  "discount": { "type": "percent", "value": 10 },
  "note": "khách quen",
  "payment": { "method": "CASH", "received": 500000 },
  "clientId": "uuid-tu-client"
}
```

Server:

1. Kiểm tra `Idempotency-Key`:
   - Cùng key + cùng request hash → trả response cũ.
   - Cùng key + khác hash → `409 IDEMPOTENCY_CONFLICT`.
2. Đọc menu từ DB, snapshot `name` + `unitPrice`; không nhận giá/tổng từ client.
3. Kiểm tra món tồn tại, thuộc restaurant, `available=true`.
4. Kiểm tra bàn nếu có; snapshot `tableName`; không có bàn → `Mang đi`.
5. Tính tiền:
   ```text
   subtotal       = Σ unitPrice × qty
   discountAmount = min(round(amount hoặc subtotal × value / 100), subtotal)
   taxable        = subtotal − discountAmount
   tax            = round(taxable × taxRateBps / 10000)
   total          = taxable + tax
   ```
6. Payment:
   - `CASH`: bắt buộc `received >= total`; `change = received − total`.
   - `TRANSFER`/`CARD`: không bắt buộc `received`; `received/change = null`.
7. Sinh `Order.code` bằng `OrderCounter` trong transaction:
   ```text
   INSERT ... ON CONFLICT ... DO UPDATE SET lastNumber = lastNumber + 1 RETURNING lastNumber
   ```
   Business date theo `Asia/Ho_Chi_Minh`.
8. Ghi `Order`, `OrderItem`, `Payment`, `AuditLog`, `IdempotencyKey` trong một transaction.
9. Trả đơn đầy đủ.

### 9.2 Xem đơn

- `GET /api/v1/orders?from=&to=&status=&tableId=&q=&page=&limit=`
- `GET /api/v1/orders/:id`
- Tất cả role đều xem đơn trong restaurant.
- List trả items + payment để Phase 2 dùng lại; limit mặc định 20, max 100.
- `q` tìm theo `code`, `tableName`, `cashierName`.

### 9.3 Huỷ đơn

- `POST /api/v1/orders/:id/void` body `{ reason }`.
- Chỉ Owner/Manager.
- Đơn phải `COMPLETED`; nếu đã void → `409 ORDER_ALREADY_VOIDED`.
- Transaction: order → `VOIDED`, `voidedAt`, `voidReason`; payment → `VOIDED`; audit `ORDER_VOIDED` với before/after.
- Chưa làm hoàn tiền kế toán; ghi rõ trong README.

### 9.4 Mã đơn

- Format `HD-YYYYMMDD-NNN`.
- `NNN` tăng theo `OrderCounter` của ngày.
- Không dùng `COUNT(*)` để tránh race.
- Phase 2 offline sẽ thêm device prefix; Phase 1 online-only.

---

## 10. API contract

Base: `/api/v1`

| Method | Path | Auth | Role | Mô tả |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | Public | — | Email/password, session 30d |
| POST | `/auth/pin` | Device cookie | — | Chọn user + PIN, session 12h |
| POST | `/auth/logout` | Session | Any | Huỷ session |
| GET | `/auth/me` | Session | Any | User + authMethod |
| POST | `/auth/pin/change` | Session | Any | Đổi PIN |
| GET | `/auth/staff` | Device cookie | — | Danh sách nhân viên có PIN |
| POST | `/devices` | Password session | Owner/Manager | Đăng ký thiết bị |
| GET | `/devices` | Session | Owner/Manager | Danh sách thiết bị |
| DELETE | `/devices/:id` | Session | Owner/Manager | Thu hồi thiết bị |
| GET | `/menu` | Session | Any | Categories + items |
| GET | `/menu/categories` | Session | Any | Categories |
| GET | `/tables` | Session | Any | Danh sách bàn |
| POST | `/orders` | Session | Any | Tạo đơn + payment, idempotency |
| GET | `/orders` | Session | Any | Danh sách đơn |
| GET | `/orders/:id` | Session | Any | Chi tiết đơn |
| POST | `/orders/:id/void` | Session | Owner/Manager | Huỷ đơn + audit |
| GET | `/audit` | Session | Owner/Manager | Audit log |
| GET | `/health` | Public | — | Health + DB check |

### 10.1 Response thành công

```json
{
  "data": {},
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

- `meta` chỉ có ở list.
- Single resource: `{ "data": { ... } }`.

### 10.2 Response lỗi

```json
{
  "error": {
    "code": "ORDER_INVALID_PAYMENT",
    "message": "Tiền khách đưa không đủ",
    "details": []
  }
}
```

Mã lỗi chính:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
IDEMPOTENCY_CONFLICT
ORDER_INVALID_PAYMENT
ORDER_INVALID_DISCOUNT
ORDER_ALREADY_VOIDED
DEVICE_REQUIRED
DEVICE_REVOKED
PIN_INVALID
INTERNAL_ERROR
```

HTTP status:

- `200` đọc/cập nhật thành công.
- `201` tạo mới.
- `400` validation.
- `401` chưa đăng nhập/PIN sai.
- `403` sai quyền.
- `404` không tìm thấy.
- `409` xung đột idempotency/trạng thái.
- `422` vi phạm nghiệp vụ (nếu tách khỏi 400).
- `500` lỗi server.

### 10.3 Ví dụ login

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "name": "Chủ quán",
      "email": "owner@restodash.local",
      "role": "OWNER",
      "restaurantId": "uuid"
    },
    "authMethod": "password",
    "expiresAt": "2026-12-19T00:00:00.000Z"
  }
}
```

### 10.4 Ví dụ tạo đơn

```json
{
  "data": {
    "id": "uuid",
    "code": "HD-20261119-001",
    "status": "COMPLETED",
    "tableId": null,
    "tableName": "Mang đi",
    "items": [
      {
        "menuItemId": "uuid",
        "name": "Gà nướng",
        "unitPrice": 120000,
        "qty": 2,
        "note": "ít cay"
      }
    ],
    "subtotal": 240000,
    "discountType": "PERCENT",
    "discountValue": 10,
    "discountAmount": 24000,
    "tax": 17280,
    "total": 233280,
    "payment": {
      "method": "CASH",
      "amount": 233280,
      "received": 500000,
      "change": 266720,
      "status": "COMPLETED"
    },
    "note": "khách quen",
    "cashierName": "Thu ngân",
    "createdAt": "2026-11-19T10:00:00.000Z"
  }
}
```

---

## 11. Bảo mật và audit

### 11.1 Hash và cookie

- Password: Argon2id, hash đầy đủ.
- PIN: Argon2id trên `pin + PIN_PEPPER`.
- Device token: random 32 byte; lưu SHA-256; cookie httpOnly 1 năm.
- Session cookie: httpOnly, sameSite=lax, secure production.
- PIN/device token không bao giờ trả lại trong response.

### 11.2 CSRF và CORS

- `helmet`.
- Kiểm tra `Origin` cho `POST/PATCH/PUT/DELETE`; nếu có Origin và không nằm trong `CORS_ORIGINS` → 403.
- CORS credentials cho `http://localhost:5173` khi Phase 2 nối frontend.
- Swagger local chạy cùng origin nên cookie hoạt động.

### 11.3 Rate limit

- Chỉ email/password login: 5 lần/phút/IP.
- PIN: **không rate limit, không lock** theo D-12; chỉ audit.
- Ghi nhận rủi ro brute force PIN 4 số; bù bằng device binding + session 12h + audit.

### 11.4 Audit

Actions:

```text
AUTH_LOGIN_SUCCESS
AUTH_LOGIN_FAILED
PIN_LOGIN_SUCCESS
PIN_LOGIN_FAILED
PIN_CHANGED
DEVICE_REGISTERED
DEVICE_REVOKED
ORDER_CREATED
ORDER_VOIDED
```

- Audit order nằm trong cùng transaction với order.
- Audit login/PIN best-effort, không làm lộ password/PIN/token.
- Lưu IP, user agent, actorId, deviceId, entity, before/after.

### 11.5 Vận hành

- Postgres chỉ bind localhost.
- `.env` gitignore; `.env.example` không có secret thật.
- Backup/restore có script và test.
- Swagger bật local; production phải tắt hoặc bảo vệ.
- Log không chứa password/PIN/token.

---

## 12. Seed data

### 12.1 Restaurant

- `slug`: `restodash`
- Tên/địa chỉ/phone lấy từ `src/config.ts`.
- `taxRateBps`: `800`
- `currency`: `VND`
- `timezone`: `Asia/Ho_Chi_Minh`

### 12.2 Tài khoản mẫu (chỉ local)

| Email | Mật khẩu | PIN | Role |
| --- | --- | --- | --- |
| `owner@restodash.local` | `Owner@12345` | `1234` | OWNER |
| `manager@restodash.local` | `Manager@12345` | `2345` | MANAGER |
| `cashier@restodash.local` | `Cashier@12345` | `3456` | CASHIER |

- Không dùng tài khoản này ngoài local.
- Seed idempotent bằng `upsert`.

### 12.3 Menu và bàn

- 6 danh mục, 16 món copy từ `src/data/menu.ts`.
- 12 bàn copy từ `src/data/tables.ts`.
- `legacyId` giữ nguyên ID frontend.
- `imageKey` lấy từ tên asset, ví dụ `ga-nuong`.
- Không serve file ảnh trong Phase 1.

---

## 13. Test và CI

### 13.1 Unit

- `money.spec.ts`: subtotal, discount amount/percent, cap, VAT rounding, invalid values.
- `order-code.spec.ts`: counter tăng, format, timezone.
- `security.spec.ts`: hash/verify password/PIN, pepper.
- `guards.spec.ts`: roles, device, password session.

### 13.2 E2E

- Auth email/password đúng/sai; me; logout.
- Device register; staff list; PIN login đúng/sai; audit PIN fail.
- Revoke device → PIN login/staff list bị chặn; session PIN bị xoá.
- PIN change; session PIN khác bị thu hồi.
- Menu/tables trả đúng seed.
- Tạo đơn: totals, giảm giá, VAT, tiền mặt thiếu, chuyển khoản.
- Idempotency: replay cùng key trả cùng đơn; khác payload 409.
- Void: manager/owner được; cashier 403; audit.
- Audit: owner/manager đọc; cashier 403; filter/pagination.
- Health DB up.

### 13.3 Test DB

- `restodash_test` trong cùng Postgres container.
- Global setup chạy `prisma migrate deploy` với `TEST_DATABASE_URL`.
- Truncate + seed lại trước mỗi suite.
- Dùng `supertest.agent` để giữ cookie session/device.

### 13.4 CI

`.github/workflows/server.yml`:

- Postgres 17 service.
- Node 24.
- `npm ci` trong `server/`.
- `npx prisma generate`.
- `npx prisma migrate deploy` với test DB.
- `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`.

`.github/workflows/web.yml`:

- Node 24.
- `npm ci` root.
- `npm run lint`, `npm test`, `npm run build`.

---

## 14. Rủi ro đã chấp nhận

| Rủi ro | Mức độ | Bù |
| --- | --- | --- |
| PIN 4 số, không lock, chỉ audit | Cao | Device binding + PIN session 12h + audit; chấp nhận theo D-12 |
| Seed menu/bàn copy từ frontend | Trung bình | Ghi rõ là bản sao tạm; Phase 2 chốt một nguồn dữ liệu |
| Chưa có owner reset PIN | Trung bình | Tự đổi PIN; quên PIN xử lý DB trong Phase 1 |
| Chưa offline sync | Trung bình | Schema có `clientId`/`deviceId`; batch sync Phase 2 |
| Prisma 7 pin | Thấp | Pin `7.10.1`; không dùng Prisma 8 RC |
| Docker cần cài | Thấp | User đã xác nhận cài được |
| Swagger public local | Thấp | Chỉ local; production tắt/bảo vệ |
| Không nối frontend | Trung bình | Swagger + `.http` + OpenAPI làm hợp đồng |

---

## 15. Definition of Done

- [ ] Docker Compose Postgres 17 chạy healthy.
- [ ] `server/` scaffold NestJS 12 + TS 6.0.3.
- [ ] Prisma 7.10.1 generate/migrate/seed sạch từ DB trống.
- [ ] Seed 16 món, 12 bàn, 3 user; chạy lại không nhân đôi.
- [ ] Auth email/password + PIN + device hoạt động.
- [ ] Owner/Manager/Cashier đúng quyền.
- [ ] Menu/tables API trả đúng seed.
- [ ] Tạo đơn đúng tiền; tiền mặt thiếu bị chặn.
- [ ] Idempotency replay/conflict đúng.
- [ ] Void đúng quyền + audit.
- [ ] Audit API đọc được; cashier bị chặn.
- [ ] Swagger `/api/docs` đầy đủ; cookie auth hoạt động.
- [ ] Unit + E2E + lint + build pass.
- [ ] CI server + web xanh.
- [ ] Frontend root vẫn 113/113 test.
- [ ] Backup/restore đã test.
- [ ] `server/README.md`, `.http`, Makefile đầy đủ.
- [ ] `PROJECT.md` cập nhật quyết định backend.
- [ ] Không có secret trong repo.
- [ ] Không thay đổi file trong `src/` frontend.

---

## 16. Quy trình git

1. Merge PR #1 (frontend v1 + PROJECT.md).
2. `git checkout main && git pull`.
3. `git checkout -b feat/backend-foundation`.
4. Commit theo task nhỏ.
5. PR mô tả: mục tiêu, phạm vi, ảnh Swagger, test đã chạy, rủi ro, checklist.
6. Không merge khi test/lint/build đỏ.
7. Sau merge: cập nhật `PROJECT.md` (ADR backend, roadmap Phase 1 hoàn thành) và README nếu cần.

---

## 17. Ghi chú cho Phase 2 (nối frontend)

- Thêm service layer frontend, gọi `/api/v1`.
- Thêm router/deep-link.
- Thêm login UI + device registration + chọn nhân viên/PIN.
- Thêm offline outbox IndexedDB + `/sync`.
- Import localStorage một lần, idempotent.
- Chuyển menu/bàn sang một nguồn dữ liệu chung.
- Giữ snapshot hoá đơn và in 80mm.
