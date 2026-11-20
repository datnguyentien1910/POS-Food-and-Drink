# RestoDash POS — Backend (Phase 1)

API backend cho RestoDash POS: NestJS 12 + PostgreSQL 17 + Prisma 7. Phase 1 là **backend-only**; frontend v1 (`/src`) không đổi và chưa nối API.

- Tài liệu thiết kế: [spec](../docs/superpowers/specs/2026-11-19-backend-foundation-spec.md) · [plan](../docs/superpowers/plans/2026-11-19-backend-foundation-plan.md).
- Kiến trúc tổng thể, ADR, lộ trình: [`../PROJECT.md`](../PROJECT.md).

## Yêu cầu

- Node.js `>=24` (đã kiểm thử trên Node 26 local và Node 24 trên CI).
- Docker + Docker Compose (chạy PostgreSQL 17).
- npm.

## Cài đặt

```bash
cd server
npm install
cp .env.example .env   # rồi sửa mật khẩu/secret bên dưới
```

Cài Docker nếu máy chưa có:

```bash
# Ubuntu/Debian
sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker "$USER"   # đăng nhập lại để nhóm có hiệu lực
```

## Biến môi trường

| Biến | Ý nghĩa |
| --- | --- |
| `NODE_ENV` | `development` / `test` / `production` |
| `PORT` | Cổng HTTP (mặc định `3001`) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Thông tin container Postgres |
| `DATABASE_URL` | Chuỗi kết nối DB chính |
| `TEST_DATABASE_URL` | Chuỗi kết nối DB cho e2e (`restodash_test`) |
| `SESSION_SECRET` | Bí mật ký session (>= 32 ký tự) |
| `PIN_PEPPER` | Pepper băm PIN (>= 32 ký tự) |
| `CORS_ORIGINS` | Danh sách origin cho phép, phân tách bằng dấu phẩy |
| `SWAGGER_ENABLED` | `true` để mở Swagger UI ở `/api/docs` |

Không commit `.env`; `.gitignore` đã bỏ qua `.env`, `backups/` và client Prisma sinh tự động.

## Chạy nhanh

```bash
make up             # docker compose up -d db
make migrate        # npx prisma migrate deploy
make seed           # nạp dữ liệu mẫu (idempotent)
npm run start:dev   # http://localhost:3001/api/v1
```

- Health: `GET http://localhost:3001/api/v1/health` (kỳ vọng `db: up`).
- Swagger: `http://localhost:3001/api/docs`.

Không dùng `make`, chạy trực tiếp:

```bash
npm run db:deploy   # prisma migrate deploy
npm run db:seed     # prisma db seed
```

## Tài khoản mẫu (chỉ dùng local)

Seed tạo 3 tài khoản. **Chạy lại seed sẽ đặt lại mật khẩu và PIN về giá trị dưới đây**; không dùng cho production.

| Email | Mật khẩu | PIN | Role |
| --- | --- | --- | --- |
| `owner@restodash.local` | `Owner@12345` | `1234` | OWNER |
| `manager@restodash.local` | `Manager@12345` | `2345` | MANAGER |
| `cashier@restodash.local` | `Cashier@12345` | `3456` | CASHIER |

Seed cũng tạo 6 nhóm món (16 món) và 12 bàn.

## API

Prefix `/api/v1`, Swagger mở ở `/api/docs`. Response thành công: `{ "data": ..., "meta"?: ... }`; lỗi: `{ "error": { "code", "message", "details"? } }`. Xác thực qua cookie phiên `restodash.sid`.

| Method | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/health` | công khai | Trạng thái app + DB |
| `POST` | `/auth/login` | công khai | Đăng nhập email/mật khẩu |
| `GET` | `/auth/me` | phiên | Thông tin phiên hiện tại |
| `GET` | `/auth/staff` | công khai + thiết bị | Nhân viên có PIN trên thiết bị này |
| `POST` | `/auth/pin` | công khai + thiết bị | Đăng nhập bằng PIN |
| `POST` | `/auth/pin/change` | phiên | Đổi PIN của chính mình |
| `POST` | `/auth/logout` | phiên | Đăng xuất |
| `POST` | `/devices` | OWNER, MANAGER | Đăng ký thiết bị bán hàng |
| `GET` | `/devices` | phiên | Danh sách thiết bị của quán |
| `DELETE` | `/devices/:id` | OWNER, MANAGER | Thu hồi thiết bị |
| `GET` | `/menu` | phiên | Thực đơn đầy đủ theo nhóm |
| `GET` | `/menu/categories` | phiên | Danh sách nhóm món |
| `GET` | `/tables` | phiên | Danh sách bàn |
| `POST` | `/orders` | OWNER, MANAGER, CASHIER | Tạo đơn kèm thanh toán (cần `Idempotency-Key`) |
| `GET` | `/orders` | OWNER, MANAGER, CASHIER | Danh sách đơn (lọc + phân trang) |
| `GET` | `/orders/:id` | OWNER, MANAGER, CASHIER | Chi tiết một đơn |
| `POST` | `/orders/:id/void` | OWNER, MANAGER | Huỷ đơn |
| `GET` | `/audit` | OWNER, MANAGER | Nhật ký hoạt động (lọc + phân trang) |

Mẫu request: [`docs/api.http`](docs/api.http).

## Luồng xác thực

1. **Email/mật khẩu**: `POST /auth/login` → phiên **30 ngày**, cookie `restodash.sid` (`HttpOnly`, rolling). Giới hạn 5 lần/phút/IP.
2. **Đăng ký thiết bị**: OWNER/MANAGER (chỉ phiên mật khẩu) gọi `POST /devices` → nhận cookie `restodash.device`.
3. **PIN gắn thiết bị**: trên thiết bị đã đăng ký, `GET /auth/staff` để chọn nhân viên rồi `POST /auth/pin`. Phiên PIN **tuyệt đối 12 giờ**.
4. **Phân quyền**: OWNER/MANAGER/CASHIER; endpoint ghi/thu hồi/huỷ giới hạn theo role.

PIN **không bị khoá** khi nhập sai (quyết định D-12, rủi ro đã chấp nhận) và không áp rate limit.

## Quy tắc tiền

- Tiền là **số nguyên VND**; không dùng số thập phân.
- Thuế VAT 8% (`taxRateBps = 800`), tính **sau** giảm giá.
- Đơn lưu **snapshot** tên/giá món tại thời điểm bán; sửa menu không làm sai lịch sử.
- Tiền thối (tiền mặt) không được âm khi thu thiếu.

## Idempotency và huỷ đơn

- `POST /orders` **bắt buộc** header `Idempotency-Key` (1..100 ký tự). Gửi lại cùng key + cùng payload trả về đơn cũ; cùng key + payload khác trả `409`.
- `clientId` (UUID tuỳ chọn) là định danh đơn do client sinh (chuẩn bị cho đồng bộ offline Phase 2). Gửi lại cùng `clientId` — kể cả với `Idempotency-Key` mới — trả về đơn đã tạo thay vì tạo trùng hoặc lỗi 500.
- Mã đơn dạng `HD-YYYYMMDD-NNN`, sinh theo ngày nghiệp vụ qua `OrderCounter`.
- `POST /orders/:id/void` chỉ OWNER/MANAGER. Đơn đã huỷ không thể huỷ lại (an toàn khi chạy song song) và mọi thao tác đều ghi audit.

## Sao lưu và phục hồi

```bash
make backup  DB=restodash FILE=backups/restodash.dump
make restore DB=restodash FILE=backups/restodash.dump
# hoặc trực tiếp:
./scripts/backup.sh restodash backups/restodash.dump
./scripts/restore.sh restodash backups/restodash.dump
```

- `backup.sh` dùng `pg_dump -Fc`; `restore.sh` dùng `pg_restore --clean --if-exists`.
- Cả hai chạy qua `docker compose exec -T db`, đọc thông tin đăng nhập từ biến môi trường của container, **không hardcode mật khẩu**.
- Thư mục `backups/` đã được `.gitignore` bỏ qua.

Khôi phục vào DB đích (ví dụ tạo bản kiểm thử trước khi đè dữ liệu thật):

```bash
docker compose exec -T db createdb -U "$POSTGRES_USER" restodash_restore_test
./scripts/restore.sh restodash_restore_test backups/restodash.dump
docker compose exec -T db psql -U "$POSTGRES_USER" -d restodash_restore_test -tAc 'select count(*) from "MenuItem";'
docker compose exec -T db dropdb -U "$POSTGRES_USER" restodash_restore_test
```

## Kiểm thử và CI

```bash
npm run lint      # oxlint
npm test          # unit (Vitest)
npm run test:e2e  # e2e (Vitest + Supertest, cần DB test)
npm run build     # nest build
```

- e2e tự áp migration và seed lên `TEST_DATABASE_URL` trước khi chạy; dữ liệu vận hành được reset giữa các test.
- CI: [`.github/workflows/server.yml`](../.github/workflows/server.yml) — Postgres 17 service, Node 24, chạy `prisma generate` → `migrate deploy` → lint → unit → e2e → build. Frontend có workflow riêng `web.yml`.

## Reset cơ sở dữ liệu

```bash
make db-reset   # prisma migrate reset --force: xoá, migrate lại, seed lại
```

Hoặc xoá hẳn volume rồi dựng lại: `docker compose down -v && make up && make migrate && make seed`.

## Giới hạn Phase 1

- Chưa nối frontend; frontend v1 vẫn đọc/ghi dữ liệu trên thiết bị.
- Thực đơn và bàn chỉ đọc; chưa có CRUD món/bàn/nhân viên.
- PIN không bị khoá khi nhập sai (D-12, rủi ro đã chấp nhận); chỉ email/mật khẩu bị rate limit.
- Mỗi đơn một payment; chưa hỗ trợ hoàn tiền, chia nhiều phương thức thanh toán.
- Chưa có trạng thái bàn, đặt bàn, báo cáo, offline sync, deploy VPS.
