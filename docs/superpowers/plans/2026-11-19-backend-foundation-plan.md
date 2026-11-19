# RestoDash POS — Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng backend NestJS + PostgreSQL chạy local với auth email/PIN gắn thiết bị, menu/bàn chỉ đọc, tạo/xem/huỷ đơn có thanh toán, audit, idempotency, Swagger, test và CI — không thay đổi frontend.

**Architecture:** Một API process trong `server/`, một PostgreSQL 17 qua Docker Compose. Prisma 7 + `@prisma/adapter-pg`; session lưu Postgres; guard toàn cục cho auth + role; response bọc `{ data, meta? }`. Frontend hiện tại vẫn dùng localStorage và không gọi API trong Phase 1.

**Tech Stack:** NestJS 12.5 + Express 5, TypeScript 6.0.3, PostgreSQL 17 Alpine, Prisma 7.10.1, `@prisma/adapter-pg`, Passport local + `express-session` + `connect-pg-simple`, Argon2id, Jest + Supertest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-19-backend-foundation-spec.md`

## Global Constraints

- Không sửa bất kỳ file nào trong `src/`, `public/`, `package.json`, `package-lock.json`, `vite.config.ts` ở root. Root `npm test` phải vẫn 113/113.
- Toàn bộ backend nằm trong `server/`; không thêm npm workspace ở root.
- API prefix `/api/v1`; Swagger tại `/api/docs`; health tại `/api/v1/health`.
- Success: `{ data, meta? }`; list dùng `meta = { page, limit, total, totalPages }`. Error: `{ error: { code, message, details? } }`. Message user-facing bằng tiếng Việt, code bằng tiếng Anh.
- Role chỉ có `OWNER`, `MANAGER`, `CASHIER`.
- Tiền là `Int` VND; `taxRateBps = 800`; VAT tính sau giảm giá; làm tròn half-up bằng `Math.round`.
- Order code `HD-YYYYMMDD-NNN`, ngày theo `Asia/Ho_Chi_Minh`; counter theo `(restaurantId, businessDate)`.
- Một payment cho mỗi đơn trong Phase 1; schema vẫn cho phép mở rộng.
- `POST /orders` bắt buộc header `Idempotency-Key`; server luôn đọc giá từ DB, không nhận giá/tổng từ client.
- PIN đúng 4 chữ số, không lock, không rate limit, chỉ audit; PIN bắt buộc đi qua device cookie; session PIN 12 giờ tuyệt đối.
- Password session 30 ngày rolling. Cookie session `restodash.sid`; cookie thiết bị `restodash.device`, httpOnly, sameSite=lax, secure khi production.
- Không commit `.env`, secret, dump, `src/generated/prisma`.
- Node local 26, CI Node 24 LTS; Prisma pin `7.10.1`; server TypeScript pin `6.0.3`; Nest pin `12.5.x`.
- Mọi thao tác nhạy cảm ghi `AuditLog`; order + audit nằm trong cùng transaction.
- Không fake số liệu vận hành; seed chỉ là dữ liệu mẫu local.

## Review Focus

1. **Client gửi giá/tổng/field lạ trong item** — phải bị chặn bởi `forbidNonWhitelisted` hoặc bị bỏ qua, và tổng tiền luôn tính lại từ DB. Test tại Task 7 (`rejects unitPrice in item`).
2. **Idempotency replay và đua request** — cùng key + cùng payload trả cùng một đơn, không tạo đơn thứ hai; khác payload trả 409; hai request song song chỉ tạo một đơn. Test tại Task 7.
3. **Mốc nửa đêm Việt Nam** — `16:59:59Z` vẫn là ngày cũ, `17:00:00Z` sang ngày mới và counter reset. Test tại Task 6.
4. **Biên tính tiền** — giảm giá > tạm tính bị cap, 100% ra total 0, VAT lẻ làm tròn đúng, khách đưa đúng bằng total thì change 0, thiếu 1 đồng bị chặn. Test tại Task 6 và Task 7.
5. **Thiết bị bị thu hồi** — staff list và PIN login bị chặn ngay; session PIN gắn thiết bị bị xoá. Test tại Task 4.

---

## Trước khi bắt đầu

- [ ] Merge PR #1 (frontend v1 + `PROJECT.md`): `gh pr merge 1 --merge --delete-branch`; sau đó `git checkout main && git pull`.
- [ ] Tạo nhánh: `git checkout -b feat/backend-foundation`.
- [ ] Cài Docker theo spec §6.2; xác nhận `docker compose version` và `docker run --rm hello-world`.
- [ ] Xác nhận working tree sạch và `git diff main -- src/` rỗng.
- [ ] Đọc spec trước mỗi task; task nào chạm interface của task trước thì đọc block **Interfaces** của task đó.

---

### Task 1: Docker, scaffold NestJS, config, health, envelope

**Files:**
- Create: `server/docker-compose.yml`
- Create: `server/docker/init/01-create-test-db.sql`
- Create: `server/.env.example`
- Create: `server/.gitignore`
- Create via CLI: toàn bộ scaffold `server/`
- Create: `server/prisma/schema.prisma` (chỉ datasource + generator)
- Create: `server/prisma.config.ts`
- Create: `server/src/prisma/create-prisma-client.ts`, `prisma.service.ts`, `prisma.module.ts`
- Create: `server/src/config/env.ts`, `src/config/env.spec.ts`
- Create: `server/src/common/errors/app.exception.ts`
- Create: `server/src/common/filters/all-exceptions.filter.ts`
- Create: `server/src/common/interceptors/transform.interceptor.ts`
- Create: `server/src/common/types/api.ts`
- Create: `server/src/common/middleware/origin-check.middleware.ts`
- Create: `server/src/health/health.module.ts`, `health.controller.ts`, `health.service.ts`, `health.service.spec.ts`
- Create: `server/src/app.setup.ts`
- Modify: `server/src/main.ts`, `server/src/app.module.ts`, `server/package.json`, `server/tsconfig.json`, `server/tsconfig.build.json`
- Create: `server/test/jest-e2e.json`, `test/setup-env.ts`, `test/helpers/create-test-app.ts`, `test/health.e2e-spec.ts`

**Interfaces:**
- `createPrismaClient(connectionString: string): PrismaClient` — dùng chung cho `PrismaService` và seed.
- `validateEnv(config: Record<string, unknown>): Env` — throw lỗi rõ ràng nếu thiếu/sai.
- `class AppException extends HttpException` — `constructor(status: number, code: string, message: string, details?: unknown)`.
- `class Paginated<T>` — `constructor(readonly data: T[], readonly meta: ApiMeta)`.
- `configureApp(app: INestApplication): void` — pipe/filter/interceptor/prefix/swagger/origin-check; dùng chung bởi `main.ts` và test.
- `ApiMeta = { page: number; limit: number; total: number; totalPages: number }`.

- [ ] **Step 1: Scaffold và pin dependency**

Chạy từ root repo:

```bash
npx @nestjs/cli@12 new server --package-manager npm --skip-git --strict
cd server
# nếu CLI 12 chưa có, dùng CLI mới nhất rồi pin framework 12.5.x bên dưới
npm i @nestjs/config zod @prisma/client@7.10.1 @prisma/adapter-pg@7.10.1 pg helmet cookie-parser class-validator class-transformer @nestjs/swagger swagger-ui-express dotenv
npm i -D prisma@7.10.1 @types/pg @types/cookie-parser tsx supertest @types/supertest typescript@6.0.3
npm i @nestjs/common@^12.5.0 @nestjs/core@^12.5.0 @nestjs/platform-express@^12.5.0
```

Pin `"engines": { "node": ">=24" }`. Scripts: `start:dev`, `build`, `lint` (không `--fix`), `lint:fix`, `test`, `test:e2e`, `prisma:generate`, `db:migrate`, `db:deploy`, `db:seed`, `db:reset`. Thêm `src/generated` vào ignore của ESLint và `tsconfig` không lint generated client.

- [ ] **Step 2: Viết `.env.example`, Docker Compose, init SQL**

`.env.example` đúng spec §6.3. `docker-compose.yml`: service `db`, image `postgres:17-alpine`, port chỉ `127.0.0.1:5432:5432`, volume `pgdata`, mount `./docker/init:/docker-entrypoint-initdb.d:ro`, healthcheck `pg_isready`, env lấy từ `${POSTGRES_USER}`, `${POSTGRES_PASSWORD}`, `${POSTGRES_DB}`. Init SQL: `CREATE DATABASE restodash_test;` (owner mặc định là user đang kết nối). `.gitignore`: `node_modules`, `dist`, `.env`, `coverage`, `backups`, `src/generated/prisma`.

- [ ] **Step 3: Viết test config trước**

`src/config/env.spec.ts`:
- env hợp lệ đầy đủ → trả object đã parse, `PORT` là number.
- thiếu `SESSION_SECRET` → throw chứa `SESSION_SECRET`.
- `SESSION_SECRET` ngắn hơn 32 ký tự → throw.
- `CORS_ORIGINS="http://localhost:5173, https://a.vn"` → helper `parseOrigins` trả mảng đã trim, bỏ rỗng.

Run: `npm test -- env.spec` → FAIL vì chưa có implementation.

- [ ] **Step 4: Implement `src/config/env.ts`**

Zod schema gồm `NODE_ENV` (default `development`), `PORT` (coerce int, default 3001), `DATABASE_URL` (url), `TEST_DATABASE_URL` (url, optional), `SESSION_SECRET` (min 32), `PIN_PEPPER` (min 32), `CORS_ORIGINS` (default `''`), `SWAGGER_ENABLED` (`'true'|'false'`, default `'true'`, transform boolean). Export `Env`, `validateEnv`, `parseOrigins`.

- [ ] **Step 5: Viết test health/envelope trước**

`src/health/health.service.spec.ts`: mock `PrismaService.$queryRaw` reject → `check()` reject `AppException` với `code = 'DB_UNAVAILABLE'`, status 503.
`test/health.e2e-spec.ts`:
- `GET /api/v1/health` → 200, `body.data` match `{ status: 'ok', db: 'up' }`, có `uptime` và `version`.
- `GET /api/v1/khong-ton-tai` → 404, `body.error.code === 'NOT_FOUND'`.
- `POST /api/v1/health` với `Origin: https://evil.example` → 403, `body.error.code === 'FORBIDDEN'`.
- `POST /api/v1/unknown` không có Origin → 404 envelope (middleware cho qua).

Run: `npm run test:e2e -- health` → FAIL.

- [ ] **Step 6: Implement envelope, filter, exception, origin-check, health, app setup**

- `AppException` giữ `code`, `details`.
- `AllExceptionsFilter`: `AppException` → map nguyên; `BadRequestException` từ ValidationPipe → `VALIDATION_ERROR`, message `Dữ liệu không hợp lệ`, details là mảng message; 404 mặc định → `NOT_FOUND`; còn lại → `INTERNAL_ERROR`, log stack kèm request id, không trả stack.
- `TransformInterceptor`: `Paginated` → `{ data, meta }`; giá trị khác → `{ data }`; bỏ qua nếu response đã gửi.
- `OriginCheckMiddleware`: chỉ áp cho `POST/PUT/PATCH/DELETE`; nếu có `Origin` và không nằm trong `parseOrigins(CORS_ORIGINS)` → 403 `FORBIDDEN`; không có Origin → cho qua.
- `HealthService.check()`: `SELECT 1`; trả `{ status: 'ok', db: 'up', uptime: process.uptime(), version: process.env.npm_package_version ?? '0.0.0' }`; lỗi → `AppException(503, 'DB_UNAVAILABLE', 'Cơ sở dữ liệu không khả dụng')`.
- `configureApp`: `helmet()`, `cookieParser()`, `setGlobalPrefix('api/v1')`, `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`, global filter + interceptor, origin middleware; Swagger nếu `SWAGGER_ENABLED`, path `api/docs`, cookie auth `restodash.sid`; `enableShutdownHooks()`.
- `PrismaService` dùng `createPrismaClient` + adapter `PrismaPg({ connectionString })`; `onModuleInit` connect, `onModuleDestroy` disconnect.
- `prisma/schema.prisma` generator:

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}
datasource db { provider = "postgresql" }
```

`prisma.config.ts` dùng `defineConfig` + `env('DATABASE_URL')`, `migrations.seed = 'tsx prisma/seed.ts'`. (Task 2 mới tạo `seed.ts`; ở Task 1 có thể để script và bỏ qua nếu chưa chạy seed.)

- [ ] **Step 7: Chạy DB + generate + test**

```bash
cp .env.example .env   # sửa secret bằng openssl rand -hex 32
docker compose up -d db
npx prisma generate
npm test
npm run test:e2e -- health
npm run lint
npm run build
curl -s http://localhost:3001/api/v1/health
```

Kỳ vọng: unit pass, health e2e pass, build pass; response health có envelope.

- [ ] **Step 8: Commit**

```bash
git add server
git commit -m "chore(server): scaffold NestJS API with health, config and response envelope"
```

### Task 2: Prisma schema, migration, seed, hash tiện ích

**Files:**
- Modify: `server/prisma/schema.prisma` (full models)
- Create: `server/prisma/migrations/<timestamp>_init/migration.sql` (do `prisma migrate dev` sinh)
- Create: `server/src/prisma/seed-data.ts`
- Create: `server/prisma/seed.ts`
- Create: `server/src/common/security/hash.ts`, `hash.spec.ts`
- Create: `server/src/prisma/seed-data.spec.ts`
- Create: `server/test/global-setup.ts`, `test/helpers/db.ts`, `test/seed.e2e-spec.ts`
- Modify: `server/test/jest-e2e.json`, `server/package.json`

**Interfaces:**
- `hashSecret(secret: string, pepper?: string): Promise<string>` — Argon2id; nếu có pepper thì hash `secret + pepper`.
- `verifySecret(hash: string, secret: string, pepper?: string): Promise<boolean>`.
- `sha256Hex(value: string): string` — dùng cho device token ở Task 4.
- `seed(prisma: PrismaClient, options: { pinPepper: string }): Promise<void>` — idempotent.
- `resetOperationalData(prisma: PrismaClient): Promise<void>` — truncate `OrderItem`, `Payment`, `Order`, `IdempotencyKey`, `OrderCounter`, `AuditLog`, `Device`, `session`; giữ user/menu/table/category.
- Model types import từ `../generated/prisma/client` (alias `Order as OrderModel` khi trùng tên domain).

- [ ] **Step 1: Viết test hash trước**

`src/common/security/hash.spec.ts`:
- hash rồi verify đúng → `true`; sai secret → `false`.
- hai lần hash cùng secret ra chuỗi khác nhau (salt).
- PIN có pepper: verify đúng với cùng pepper, sai pepper → `false`.
- `sha256Hex('abc')` ổn định và đúng 64 ký tự hex.

Run: `npm test -- hash.spec` → FAIL.

- [ ] **Step 2: Implement `hash.ts`**

Argon2id với `memoryCost: 19456`, `timeCost: 2`, `parallelism: 1`. Không log secret. `sha256Hex` dùng `createHash('sha256')`.

- [ ] **Step 3: Viết schema Prisma đầy đủ**

Bắt buộc có các model/trường sau (kiểu Prisma, ID `String @id @default(uuid()) @db.Uuid` trừ khi ghi khác):

| Model | Trường và ràng buộc |
| --- | --- |
| `Restaurant` | `slug` unique, `name`, `address?`, `phone?`, `taxRateBps Int @default(800)`, `currency String @default("VND")`, `timezone String @default("Asia/Ho_Chi_Minh")`, timestamps |
| `User` | `email` unique, `name`, `passwordHash`, `pinHash?`, `active Boolean @default(true)`, timestamps |
| `Membership` | `restaurantId`, `userId`, `role Role`; `@@unique([restaurantId, userId])` |
| `Session` | `sid String @id @db.VarChar`, `sess Json @db.Json`, `expire DateTime @db.Timestamp(6)`; `@@map("session")`, `@@index([expire])` |
| `Device` | `restaurantId`, `name`, `tokenHash` unique, `registeredById`, `lastSeenAt?`, `revokedAt?`, `createdAt` |
| `Category` | `restaurantId`, `name`, `sortOrder Int @default(0)`; `@@unique([restaurantId, name])` |
| `MenuItem` | `restaurantId`, `categoryId`, `legacyId?`, `name`, `description?`, `price Int`, `imageKey?`, `available Boolean @default(true)`, `popular Boolean @default(false)`, `sortOrder Int @default(0)`; `@@unique([restaurantId, legacyId])` |
| `Table` | `restaurantId`, `legacyId?`, `name`, `seats Int`, `zone?`, `sortOrder Int @default(0)`; `@@unique([restaurantId, legacyId])` |
| `Order` | `restaurantId`, `code`, `clientId? @db.Uuid`, `tableId?`, `tableName`, `status OrderStatus @default(COMPLETED)`, `subtotal Int`, `discountType DiscountType?`, `discountValue Int?`, `discountAmount Int @default(0)`, `tax Int`, `total Int`, `note?`, `cashierId`, `cashierName`, `createdAt`, `voidedAt?`, `voidReason?`; `@@unique([restaurantId, code])`, `@@unique([restaurantId, clientId])`, `@@index([restaurantId, createdAt])`, `@@index([restaurantId, status])` |
| `OrderItem` | `orderId`, `menuItemId?`, `name`, `unitPrice Int`, `qty Int`, `note?` |
| `Payment` | `orderId` unique, `method PaymentMethod`, `amount Int`, `received Int?`, `change Int?`, `status PaymentStatus @default(COMPLETED)`, `reference?`, `createdAt` |
| `AuditLog` | `restaurantId`, `actorId?`, `deviceId? String? @db.Uuid`, `action AuditAction`, `entity?`, `entityId?`, `before Json?`, `after Json?`, `ip?`, `userAgent?`, `createdAt`; index `(restaurantId, createdAt)`, `(restaurantId, action, createdAt)` |
| `IdempotencyKey` | `restaurantId`, `key`, `endpoint`, `requestHash`, `statusCode Int`, `responseJson Json`, `createdAt`; `@@unique([restaurantId, endpoint, key])`, `@@index([createdAt])` |
| `OrderCounter` | `restaurantId`, `businessDate String`, `lastNumber Int @default(0)`; `@@id([restaurantId, businessDate])` |

Enums: `Role { OWNER MANAGER CASHIER }`, `OrderStatus { COMPLETED VOIDED }`, `PaymentMethod { CASH TRANSFER CARD }`, `PaymentStatus { COMPLETED VOIDED }`, `DiscountType { AMOUNT PERCENT }`, `AuditAction` gồm đúng 9 giá trị: `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILED`, `PIN_LOGIN_SUCCESS`, `PIN_LOGIN_FAILED`, `PIN_CHANGED`, `DEVICE_REGISTERED`, `DEVICE_REVOKED`, `ORDER_CREATED`, `ORDER_VOIDED`.

Quan hệ: `OrderItem`/`Payment` cascade theo `Order`; `Order.cashierId`, `Device.registeredById`, `Category→MenuItem` restrict; `Order.tableId` và `OrderItem.menuItemId` set null; `AuditLog.actor` optional relation set null; `AuditLog.deviceId` là cột thường, không relation.

- [ ] **Step 4: Tạo migration và kiểm tra bảng session**

```bash
npx prisma migrate dev --name init
docker compose exec db psql -U restodash -d restodash -c '\d session'
```

Kỳ vọng: cột `sid`, `sess` kiểu `json`, `expire` kiểu `timestamp(6)`; bảng có PK và index expire. Nếu `connect-pg-simple` không tương thích, sửa migration (không sửa package) và chạy lại từ DB trống.

- [ ] **Step 5: Viết seed data + test trước**

`src/prisma/seed-data.spec.ts`:
- đúng 6 category, 16 menu item, 12 table, 3 user.
- `legacyId` unique trong menu và table; mọi `categoryId` của item trỏ tới category có thật.
- mọi `price > 0` và là số nguyên; `seats > 0`.
- đúng một `OWNER`, một `MANAGER`, một `CASHIER`.
- restaurant `taxRateBps === 800`, `currency === 'VND'`, `timezone === 'Asia/Ho_Chi_Minh'`.
- có item `ga-nuong` với giá đúng bằng `src/data/menu.ts`; có bàn `ban-1`.

Copy tên/giá/mô tả/`imageKey` từ `src/data/menu.ts`, thứ tự bàn từ `src/data/tables.ts`, thông tin quán từ `src/config.ts`. Không import file frontend vào server.

Run: `npm test -- seed-data` → FAIL.

- [ ] **Step 6: Implement `seed-data.ts` + `seed.ts`**

`seed.ts`:
- tạo client bằng `createPrismaClient(process.env.DATABASE_URL!)`.
- restaurant upsert theo `slug = 'restodash'`.
- user upsert theo email; hash password bằng `hashSecret(password)`; PIN bằng `hashSecret(pin, PIN_PEPPER)`.
- membership upsert theo `(restaurantId, userId)`.
- category upsert theo `(restaurantId, name)`; menu item theo `(restaurantId, legacyId)`; table theo `(restaurantId, legacyId)`.
- tài khoản: `owner@restodash.local` / `Owner@12345` / `1234`; `manager@restodash.local` / `Manager@12345` / `2345`; `cashier@restodash.local` / `Cashier@12345` / `3456`.
- chạy lại không nhân đôi; ghi rõ trong comment rằng seed reset mật khẩu/PIN mẫu.
- đóng client trong `finally`.

`test/global-setup.ts`: load `dotenv/config`; dùng `TEST_DATABASE_URL`; chạy `npx prisma migrate deploy` và `npx tsx prisma/seed.ts` qua `child_process.execSync` với env `DATABASE_URL` đã override. Chỉ chạy một lần cho toàn bộ e2e.

`test/helpers/db.ts`: `resetOperationalData(prisma)` như interface; gọi trong `beforeEach`/`beforeAll` của các suite e2e cần dữ liệu sạch.

`test/jest-e2e.json`: `maxWorkers: 1`, `testTimeout: 30000`, `setupFiles: ['<rootDir>/setup-env.ts']`, `globalSetup: '<rootDir>/global-setup.ts'`.

- [ ] **Step 7: Viết test seed idempotent**

`test/seed.e2e-spec.ts` (dùng app + PrismaService, không cần HTTP):
- gọi `seed` lần 2 và lần 3 → count user/category/menu/table không đổi.
- đọc owner từ DB, `verifySecret(passwordHash, 'Owner@12345') === true`; `verifySecret(pinHash, '1234', PIN_PEPPER) === true`.
- mọi item/table có `restaurantId` đúng.

Run: `npm run test:e2e -- seed` → FAIL, sau Step 6 → PASS.

- [ ] **Step 8: Chạy toàn bộ kiểm tra + commit**

```bash
npm run lint
npm test
npm run test:e2e
npm run build
git add server/prisma server/src/prisma server/src/common/security server/test prisma.config.ts
git commit -m "feat(server): add Prisma schema, migration and idempotent seed"
```

---

### Task 3: Auth email/password, session, guards, audit write

**Files:**
- Create: `server/src/auth/auth.module.ts`, `auth.controller.ts`, `auth.service.ts`
- Create: `server/src/auth/passport/local.strategy.ts`, `local-auth.guard.ts`
- Create: `server/src/auth/auth.types.ts`, `session.types.ts`
- Create: `server/src/auth/session.store.ts` (provider `SESSION_STORE` cho `connect-pg-simple`)
- Create: `server/src/auth/login-rate-limiter.ts`, `login-rate-limiter.spec.ts`
- Create: `server/src/common/decorators/public.decorator.ts`, `roles.decorator.ts`, `current-user.decorator.ts`
- Create: `server/src/common/guards/session-auth.guard.ts`, `roles.guard.ts`, `session-auth.guard.spec.ts`
- Create: `server/src/audit/audit.module.ts`, `audit.service.ts`, `audit.types.ts`
- Modify: `server/src/app.module.ts`, `app.setup.ts`, `src/main.ts`, `src/health/health.controller.ts` (thêm `@Public()`)
- Create: `server/test/auth.e2e-spec.ts`

**Interfaces:**
- `AuthenticatedUser = { id: string; name: string; email: string; role: Role; restaurantId: string }`.
- `SessionData` augmentation (top-level): `userId?`, `restaurantId?`, `name?`, `email?`, `role?`, `authMethod?: 'password' | 'pin'`, `deviceId?`, `absoluteExpiresAt?: string`.
- `LoginResponse = { user: AuthenticatedUser; authMethod: 'password'; expiresAt: string }`.
- `AuditService.record(input: AuditInput, tx?: Prisma.TransactionClient): Promise<void>`; `recordSafe(...)` best-effort cho auth.
- `AuditInput = { restaurantId: string; actorId?: string; deviceId?: string; action: AuditAction; entity?: string; entityId?: string; before?: unknown; after?: unknown; ip?: string; userAgent?: string }`.
- `LoginRateLimiter.assertAllowed(ip: string): void`; `.recordFailure(ip: string): void`; `.reset(ip: string): void`; `.resetAll(): void` (dùng trong test); constructor nhận clock `() => number` để test.
- Global guard thứ tự: `SessionAuthGuard`, `RolesGuard` qua `APP_GUARD`.

- [ ] **Step 1: Viết test rate limiter trước**

`src/auth/login-rate-limiter.spec.ts`:
- 5 failure trong 60s → `assertAllowed` không throw.
- failure thứ 6 → `assertAllowed` throw `AppException` code `RATE_LIMITED` status 429.
- sau 60_001ms → cho phép lại.
- `reset(ip)` xoá lịch sử.
- IP khác không bị ảnh hưởng.

Run: `npm test -- login-rate-limiter` → FAIL.

- [ ] **Step 2: Implement limiter**

Map `ip -> number[]` timestamp failure; cửa sổ trượt 60s; dọn mảng mỗi lần gọi; không lưu quá 5 entry. Ghi chú: in-memory, đủ cho một process Phase 1.

- [ ] **Step 3: Viết test session guard (PIN absolute) trước**

`src/common/guards/session-auth.guard.spec.ts`: session `authMethod='pin'`, `absoluteExpiresAt` trong quá khứ → throw 401 `UNAUTHORIZED` trước khi query DB; session password không có `absoluteExpiresAt` → không throw ở bước expiry. Mock `Reflector` trả `isPublic = false`.

- [ ] **Step 4: Implement auth types, decorators, session store, strategy, service, guards**

- `@Public()` set metadata `isPublic`; `@Roles(...roles)` set metadata `roles`; `@CurrentUser()` trả `req.user`.
- `SessionAuthGuard`: nếu public → true; không có `session.userId` → 401 `UNAUTHORIZED`; nếu PIN và `Date.parse(absoluteExpiresAt) <= Date.now()` → destroy session, 401; load user + membership từ Prisma, check `active`; gán `req.user`; không tin role trong cookie.
- `RolesGuard`: nếu public → true; lấy roles metadata; không có metadata → cho qua; thiếu role → 403 `FORBIDDEN`.
- `LocalStrategy` (`passport-local`, `usernameField: 'email'`): gọi `AuthService.validatePassword`; sai → `AppException(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng')`; không tiết lộ email tồn tại.
- `LocalAuthGuard extends AuthGuard('local')`: override `handleRequest`; khi lỗi thì `limiter.recordFailure(ip)`, audit `AUTH_LOGIN_FAILED` với IP/UA (best-effort), rồi throw lỗi gốc. Guard `LoginThrottleGuard` kiểm tra `limiter.assertAllowed(ip)` trước `AuthGuard('local')`.
- `AuthService.validatePassword`: tìm user theo email; verify Argon2id; check active + membership; trả `AuthenticatedUser`.
- `AuthService.createPasswordSession(req, user)`: `req.session.regenerate()`, gán top-level fields, `authMethod='password'`, `cookie.maxAge = 30 ngày`; `limiter.reset(ip)`; audit `AUTH_LOGIN_SUCCESS`; trả `LoginResponse` với `expiresAt` từ cookie.
- `GET /auth/me` trả `{ user, authMethod, expiresAt }`; `POST /auth/logout` destroy session + clear cookie `restodash.sid`.
- `SessionStore`: `PgSession({ pool, tableName: 'session', createTableIfMissing: false })`; pool `new Pool({ connectionString: DATABASE_URL })`; provider đóng pool trong `onApplicationShutdown`.
- `configureApp`: `app.use(session({ store, name: 'restodash.sid', secret, resave: false, saveUninitialized: false, rolling: true, cookie: { httpOnly: true, sameSite: 'lax', secure: NODE_ENV === 'production', maxAge: 30 ngày } }))`; production `trust proxy 1`.
- Audit failure với email không tồn tại: resolve restaurant theo membership của email; nếu không có, dùng restaurant `slug = 'restodash'`; nếu vẫn không có thì log warn và bỏ qua audit, không chặn response.

- [ ] **Step 5: Viết e2e auth trước khi hoàn thiện controller**

`test/auth.e2e-spec.ts` (reset operational data; dùng `supertest.agent`):
- login owner đúng → 200, `data.user.role === 'OWNER'`, `data.authMethod === 'password'`, có `Set-Cookie` chứa `restodash.sid`; `GET /auth/me` 200.
- sai mật khẩu → 401 `INVALID_CREDENTIALS`; có audit `AUTH_LOGIN_FAILED`.
- logout → 200; `GET /auth/me` sau đó 401.
- không cookie gọi `/auth/me` → 401 `UNAUTHORIZED`.
- user `active=false` (set tạm rồi restore) → 401.
- 6 lần sai liên tiếp cùng IP → lần 6 trả 429 `RATE_LIMITED`; gọi `limiter.resetAll()` trong `beforeEach` để test khác không bị ảnh hưởng.
- `GET /auth/me` không trả `passwordHash`/`pinHash`.

Run: `npm run test:e2e -- auth` → FAIL; implement đến khi PASS.

- [ ] **Step 6: Swagger + lint + commit**

Thêm `@ApiTags('auth')`, `@ApiCookieAuth('restodash.sid')`, `@ApiProperty` cho DTO login.

```bash
npm run lint && npm test && npm run test:e2e -- auth && npm run build
git add server/src/auth server/src/audit server/src/common server/src/app.module.ts server/src/app.setup.ts server/src/main.ts server/test/auth.e2e-spec.ts
git commit -m "feat(server): add password auth, sessions, RBAC guards and audit writing"
```

### Task 4: Thiết bị, staff list, PIN login, đổi PIN

**Files:**
- Create: `server/src/devices/devices.module.ts`, `devices.controller.ts`, `devices.service.ts`, `device.constants.ts`, `device.types.ts`, `device.guard.ts`
- Create: `server/src/auth/pin.dto.ts`
- Modify: `server/src/auth/auth.controller.ts`, `auth.service.ts`, `auth.module.ts`
- Create: `server/src/auth/session.service.ts`
- Create: `server/test/devices.e2e-spec.ts`, `test/pin.e2e-spec.ts`
- Modify: `server/src/devices/devices.service.spec.ts` (nếu cần unit cho token)

**Interfaces:**
- `DEVICE_COOKIE = 'restodash.device'`.
- `DeviceContext = { id: string; restaurantId: string; name: string }`; gán vào `req.device` bằng module augmentation.
- `DeviceGuard`: đọc cookie, `sha256Hex`, tìm device chưa revoked; thiếu/không khớp → 401 `DEVICE_REQUIRED`; revoked → 401 `DEVICE_REVOKED`; cập nhật `lastSeenAt`.
- `SessionService.deletePinSessionsForUser(userId: string, exceptSid?: string): Promise<void>` — raw SQL.
- `SessionService.deleteSessionsForDevice(deviceId: string): Promise<void>` — raw SQL.
- `GET /auth/staff` trả `{ id, name, role }[]`; `POST /auth/pin` trả cùng shape `LoginResponse` nhưng `authMethod: 'pin'`, `expiresAt = absoluteExpiresAt`.

- [ ] **Step 1: Viết e2e devices trước**

`test/devices.e2e-spec.ts`:
- owner login password → `POST /devices { name: 'POS quầy 1' }` → 201, body không chứa token/hash, `Set-Cookie` có `restodash.device` httpOnly.
- `GET /devices` bằng password session → 200, có device vừa tạo, `current: true` cho device của cookie hiện tại.
- cashier password login → `POST /devices` 403 `FORBIDDEN`.
- manager password login → đăng ký được.
- revoke: `DELETE /devices/:id` → 200 `{ id, revokedAt }`; gọi lại → 200 idempotent, `revokedAt` giữ nguyên.
- sau revoke, dùng cookie thiết bị gọi `GET /auth/staff` → 401 `DEVICE_REVOKED`.
- thiếu cookie gọi `GET /auth/staff` → 401 `DEVICE_REQUIRED`.
- audit có `DEVICE_REGISTERED` và `DEVICE_REVOKED`.

Run: `npm run test:e2e -- devices` → FAIL.

- [ ] **Step 2: Implement devices**

- `POST /devices`: chỉ password session + `@Roles(OWNER, MANAGER)`; body `{ name }` 1..80; token `randomBytes(32).toString('base64url')`; lưu `sha256Hex(token)`; set cookie `restodash.device` 1 năm, httpOnly, sameSite lax, secure production; audit `DEVICE_REGISTERED` (không log token).
- `GET /devices`: list theo `createdAt desc`; trả `id, name, registeredById, lastSeenAt, revokedAt, createdAt, current`. `current` xác định bằng hash cookie so với `tokenHash`; không trả `tokenHash`.
- `DELETE /devices/:id`: 404 nếu không thuộc restaurant; nếu đã revoked trả nguyên trạng; nếu chưa: set `revokedAt = now`, gọi `deleteSessionsForDevice`, audit `DEVICE_REVOKED`.
- `DeviceGuard` cập nhật `lastSeenAt` mỗi request; Phase 1 chấp nhận write nhỏ này.

- [ ] **Step 3: Viết e2e PIN trước**

`test/pin.e2e-spec.ts`:
- tạo device bằng owner password trên agent A; `GET /auth/staff` → đúng 3 user, chỉ `{ id, name, role }`, không có email/hash.
- `POST /auth/pin { userId: cashier.id, pin: '3456' }` → 200 `authMethod: 'pin'`, `expiresAt` xấp xỉ now + 12h; `GET /auth/me` 200 role CASHIER.
- sai PIN → 401 `PIN_INVALID`; có audit `PIN_LOGIN_FAILED` đúng `deviceId`, `actorId`.
- PIN không đúng 4 số (`123`, `12345`, `abcd`) → 400 `VALIDATION_ERROR`.
- user không có PIN → 401 `PIN_INVALID` (không tiết lộ).
- đổi PIN: login PIN cashier trên agent A và agent B (cùng device cookie); A gọi `POST /auth/pin/change { currentPin: '3456', newPin: '4567' }` → 200; A `/auth/me` vẫn 200; B `/auth/me` 401; PIN cũ fail, PIN mới login được.
- đổi PIN sai current → 401 `PIN_INVALID`; newPin trùng current → 400 `PIN_UNCHANGED`.
- đổi PIN khi đang dùng password session cũng được; password session khác không bị xoá.
- revoke device → PIN session đang mở bị 401 ở request kế tiếp (session đã bị xoá).

Run: `npm run test:e2e -- pin` → FAIL.

- [ ] **Step 4: Implement PIN**

- `GET /auth/staff` `@Public()` + `DeviceGuard`; query user active, membership thuộc `device.restaurantId`, `pinHash != null`; sort name asc.
- `POST /auth/pin` `@Public()` + `DeviceGuard`; body `{ userId: uuid, pin: /^\d{4}$/ }`; verify Argon2id + `PIN_PEPPER`; sai ghi audit best-effort; thành công `regenerate`, gán session top-level, `authMethod='pin'`, `deviceId`, `absoluteExpiresAt = now + 12h`; audit `PIN_LOGIN_SUCCESS`.
- PIN login dùng cùng cookie session 30 ngày rolling nhưng guard chặn tuyệt đối sau 12h; khi bị chặn thì destroy session.
- `POST /auth/pin/change`: yêu cầu session bất kỳ; verify current; newPin đúng 4 số và khác current; update `pinHash`; audit `PIN_CHANGED`; `deletePinSessionsForUser(user.id, req.sessionID)`. Không có PIN → 400 `PIN_NOT_SET`.
- `SessionService` raw SQL:

```sql
DELETE FROM session
WHERE sess->>'userId' = $1
  AND sess->>'authMethod' = 'pin'
  AND ($2::text IS NULL OR sid <> $2);
```

```sql
DELETE FROM session WHERE sess->>'deviceId' = $1;
```

- [ ] **Step 5: Chạy toàn bộ + commit**

```bash
npm run lint && npm run test:e2e -- devices && npm run test:e2e -- pin && npm run build
git add server/src/devices server/src/auth server/test/devices.e2e-spec.ts server/test/pin.e2e-spec.ts
git commit -m "feat(server): add device-bound PIN login and device management"
```

---

### Task 5: API đọc menu và bàn

**Files:**
- Create: `server/src/menu/menu.module.ts`, `menu.controller.ts`, `menu.service.ts`
- Create: `server/src/tables/tables.module.ts`, `tables.controller.ts`, `tables.service.ts`
- Create: `server/test/menu.e2e-spec.ts`, `test/tables.e2e-spec.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- `GET /menu` → `{ data: { categories: MenuCategoryResponse[] } }`; category `{ id, name, sortOrder, items: MenuItemResponse[] }`.
- `MenuItemResponse = { id, legacyId, name, description, price, imageKey, available, popular, sortOrder }`.
- `GET /menu/categories` → `{ data: MenuCategorySummary[] }` (không kèm items).
- `GET /tables` → `{ data: TableResponse[] }`; `TableResponse = { id, legacyId, name, seats, zone, sortOrder }`.

- [ ] **Step 1: Viết e2e trước**

`test/menu.e2e-spec.ts`:
- cashier login → `GET /menu` 200, 6 category, tổng 16 item, mọi item có `price` integer > 0.
- item `ga-nuong` có giá đúng seed và `available: true`.
- `GET /menu/categories` 6 phần tử, sort theo `sortOrder` rồi `name`.
- không login → 401.

`test/tables.e2e-spec.ts`:
- login → `GET /tables` 12 bàn, sort theo `sortOrder`, có `ban-1` và `seats > 0`.
- không login → 401.

Run: `npm run test:e2e -- menu` và `-- tables` → FAIL.

- [ ] **Step 2: Implement service/controller**

Query theo `restaurantId` của user trong session; không nhận `restaurantId` từ query. Chỉ đọc, không expose `restaurantId` trong response. Dùng `@ApiTags('menu')`, `@ApiTags('tables')`, `@ApiCookieAuth`.

- [ ] **Step 3: Chạy + commit**

```bash
npm run lint && npm run test:e2e -- menu && npm run test:e2e -- tables && npm run build
git add server/src/menu server/src/tables server/test/menu.e2e-spec.ts server/test/tables.e2e-spec.ts server/src/app.module.ts
git commit -m "feat(server): add read-only menu and tables APIs"
```

### Task 6: Tính tiền, business date, mã đơn

**Files:**
- Create: `server/src/orders/money.ts`, `money.spec.ts`
- Create: `server/src/orders/order-code.service.ts`, `order-code.spec.ts`
- Create: `server/test/order-code.e2e-spec.ts`
- Modify: `server/src/orders/orders.module.ts` (tạo module rỗng + provider)

**Interfaces:**
- `computeOrderTotals(lines: MoneyLine[], discount: DiscountInput | null, taxRateBps: number): OrderTotals`.
- `MoneyLine = { unitPrice: number; qty: number }`; `DiscountInput = { type: 'AMOUNT' | 'PERCENT'; value: number }`.
- `OrderTotals = { subtotal: number; discountAmount: number; tax: number; total: number }`.
- `computeChange(total: number, received: number): number` — throw `AppException(400, 'ORDER_INVALID_PAYMENT', 'Tiền khách đưa không đủ')` nếu thiếu/không nguyên/âm.
- `businessDate(now: Date, timeZone: string): string` — `YYYYMMDD`.
- `formatOrderCode(businessDate: string, sequence: number): string` — `HD-${date}-${String(sequence).padStart(3, '0')}`.
- `OrderCodeService.next(tx: Prisma.TransactionClient, restaurantId: string, timeZone: string, now: Date): Promise<{ code: string; businessDate: string }>`.

- [ ] **Step 1: Viết test money trước**

`src/orders/money.spec.ts` (assert `toEqual` toàn bộ object):
- `[120000×2, 35000×1]`, percent 10, 800 → `{ subtotal: 275000, discountAmount: 27500, tax: 19800, total: 267300 }`.
- amount 300000 với subtotal 275000 → `{ subtotal: 275000, discountAmount: 275000, tax: 0, total: 0 }` (cap).
- percent 100 → total 0.
- subtotal 1007, không discount → tax 81 (80.56 làm tròn lên).
- subtotal 1000 → tax 80.
- percent 0 / amount 0 bị từ chối `ORDER_INVALID_DISCOUNT`.
- percent 101, amount âm, qty 0, qty 1.5, unitPrice âm → throw `AppException` (code `ORDER_INVALID_DISCOUNT` hoặc `ORDER_INVALID_ITEM`).
- `computeChange(267300, 500000) === 232700`; `computeChange(1000, 1000) === 0`; `computeChange(1000, 999)` throw `ORDER_INVALID_PAYMENT`.

- [ ] **Step 2: Implement `money.ts` + chạy test**

Công thức đúng spec §9.1; dùng `Math.round`; mọi input phải là số nguyên hữu hạn; discount amount cap bằng subtotal. `computeOrderTotals` không đọc DB, không mutate input.

Run: `npm test -- money.spec` → PASS.

- [ ] **Step 3: Viết test business date/code trước**

`src/orders/order-code.spec.ts`:
- `businessDate(new Date('2026-11-19T16:59:59Z'), 'Asia/Ho_Chi_Minh') === '20261119'`.
- `businessDate(new Date('2026-11-19T17:00:00Z'), 'Asia/Ho_Chi_Minh') === '20261120'`.
- `formatOrderCode('20261120', 7) === 'HD-20261120-007'`; `formatOrderCode('20261120', 1000) === 'HD-20261120-1000'`.
- timezone không hợp lệ → throw.

Run: `npm test -- order-code` → FAIL.

- [ ] **Step 4: Implement `businessDate` bằng `Intl.DateTimeFormat('en-CA', { timeZone, year, month, day })`**

Không dùng `Date#getDate()` (phụ thuộc TZ server). `formatOrderCode` chỉ nhận chuỗi date hợp lệ `^\d{8}$`.

- [ ] **Step 5: Viết e2e counter trước**

`test/order-code.e2e-spec.ts`:
- lấy `OrderCodeService` từ app; `resetOperationalData`.
- gọi `next(tx, restaurantId, 'Asia/Ho_Chi_Minh', new Date('2026-11-19T10:00:00Z'))` hai lần → `HD-20261119-001`, `HD-20261119-002`.
- gọi với `new Date('2026-11-19T17:00:00Z')` → `HD-20261120-001` (counter reset theo ngày).
- gọi lại ngày 19 → `HD-20261119-003` (counter cũ giữ nguyên).

- [ ] **Step 6: Implement `OrderCodeService.next`**

Trong transaction truyền vào:

```sql
INSERT INTO "OrderCounter" ("restaurantId", "businessDate", "lastNumber")
VALUES ($1, $2, 1)
ON CONFLICT ("restaurantId", "businessDate")
DO UPDATE SET "lastNumber" = "OrderCounter"."lastNumber" + 1
RETURNING "lastNumber";
```

Dùng `tx.$queryRaw`, lấy `lastNumber`, trả code. Không dùng `COUNT(*)`.

- [ ] **Step 7: Chạy + commit**

```bash
npm run lint && npm test -- money.spec && npm test -- order-code && npm run test:e2e -- order-code && npm run build
git add server/src/orders server/test/order-code.e2e-spec.ts
git commit -m "feat(server): add order pricing, business date and daily order code"
```

---

### Task 7: Tạo đơn, payment, idempotency

**Files:**
- Create: `server/src/orders/orders.module.ts`, `orders.controller.ts`, `orders.service.ts`
- Create: `server/src/orders/dto/create-order.dto.ts`, `orders-query.dto.ts` (query dùng lại Task 8)
- Create: `server/src/orders/order-response.ts`
- Create: `server/src/orders/idempotency.service.ts`, `idempotency.service.spec.ts`
- Create: `server/src/common/decorators/idempotency-key.decorator.ts`
- Create: `server/test/orders-create.e2e-spec.ts`
- Create: `server/test/helpers/money.ts` (helper tạo payload)
- Modify: `server/src/app.module.ts`

**Interfaces:**
- `POST /orders` body theo spec §9.1; bắt buộc header `Idempotency-Key` (1..100 ký tự), thiếu → 400 `IDEMPOTENCY_KEY_REQUIRED`.
- `OrderResponse` gồm `id, code, status, tableId, tableName, items[{ menuItemId, name, unitPrice, qty, note }], subtotal, discountType, discountValue, discountAmount, tax, total, payment, note, cashierName, createdAt, voidedAt, voidReason`.
- `IdempotencyService.execute<T>({ restaurantId, endpoint, key, payload, statusCode, handler }): Promise<T>` — `handler(tx)` tạo dữ liệu; lưu `requestHash = sha256Hex(stableStringify(payload))`; replay cùng hash trả `responseJson`; khác hash → `AppException(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key đã dùng với dữ liệu khác')`.
- `OrdersService.create(dto, actor, idempotencyKey, meta: { ip?, userAgent? }): Promise<OrderResponse>`.

- [ ] **Step 1: Viết test idempotency service trước**

`src/orders/idempotency.service.spec.ts` (mock Prisma):
- chưa có key → gọi handler đúng một lần, lưu response, trả kết quả.
- key tồn tại cùng hash → không gọi handler, trả `responseJson`.
- key tồn tại khác hash → throw `IDEMPOTENCY_CONFLICT`.
- handler throw → không lưu key (transaction rollback).
- giả lập Prisma P2002 khi insert → đọc lại row và trả response của request thắng; nếu row khác hash → 409.

Run: `npm test -- idempotency` → FAIL.

- [ ] **Step 2: Implement idempotency**

Thứ tự: tìm unique `(restaurantId, endpoint, key)` ngoài transaction; nếu có → so hash/replay. Nếu chưa → `$transaction`: chạy handler, tạo `IdempotencyKey` với `responseJson` là plain order response (không bọc envelope), `statusCode`. Catch P2002 → đọc lại row, so hash, replay. Không lưu lỗi nghiệp vụ.

- [ ] **Step 3: Viết e2e tạo đơn trước**

`test/orders-create.e2e-spec.ts` (cashier login; `resetOperationalData`; seed còn nguyên):
- **Happy path**: 2× `ga-nuong` (120000) + 1× món 35000, discount percent 10, CASH received 500000, có `tableId` `ban-1`, `clientId` uuid → 201; subtotal 275000, discountAmount 27500, tax 19800, total 267300, change 232700; code match `^HD-\d{8}-001$`; payment `amount = total`, `status COMPLETED`; audit `ORDER_CREATED`.
- **Không có Idempotency-Key** → 400 `IDEMPOTENCY_KEY_REQUIRED`.
- **Client gửi giá** `{ menuItemId, qty: 1, unitPrice: 1 }` → 400 `VALIDATION_ERROR`; không tạo order.
- **Món không tồn tại/không available**: set `available=false` tạm rồi gọi → 400 `ORDER_INVALID_ITEM`; restore.
- **Bàn không tồn tại** → 404 `TABLE_NOT_FOUND`.
- **Tiền mặt thiếu** (received = total - 1) → 400 `ORDER_INVALID_PAYMENT`; `order.count` không đổi; retry cùng key với tiền đủ → 201 (không có key rác).
- **Chuyển khoản** không có `received` → 201; payment `received = null`, `change = null`.
- **Giảm 100%** + CASH received 0 → total 0, change 0.
- **Replay cùng key + payload** → 201 lần hai, cùng `id`; `order.count === 1`.
- **Cùng key khác payload** (qty đổi) → 409 `IDEMPOTENCY_CONFLICT`.
- **Hai request song song cùng key/payload** bằng `Promise.all` → cả hai 201, cùng `id`, `order.count === 1`.
- **Hai đơn liên tiếp** → code `-001`, `-002`.
- **Mang đi** (`tableId` null) → `tableName === 'Mang đi'`.

Run: `npm run test:e2e -- orders-create` → FAIL.

- [ ] **Step 4: Implement DTO với validation nghiêm**

`CreateOrderItemDto`: `menuItemId @IsUUID`, `qty @IsInt @Min(1) @Max(99)`, `note? @IsString @MaxLength(200)`.
`DiscountDto`: `type @IsIn(['AMOUNT','PERCENT'])`, `value @IsInt @Min(1)`; kiểm tra percent <= 100 trong service.
`PaymentDto`: `method @IsIn(['CASH','TRANSFER','CARD'])`, `received? @IsInt @Min(0)`.
`CreateOrderDto`: `tableId? @IsUUID`, `items @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true })`, `discount?`, `note? @MaxLength(500)`, `payment`, `clientId? @IsUUID`.
Global `forbidNonWhitelisted` đảm bảo `unitPrice`/`total` bị 400.

- [ ] **Step 5: Implement `OrdersService.create`**

Trong `IdempotencyService.execute` với `endpoint = 'POST /orders'`:
1. Load menu items theo `id in` + `restaurantId` + `available`; so số lượng; thiếu → 400 `ORDER_INVALID_ITEM` kèm `details: { missingIds }`.
2. Load table nếu có, thuộc restaurant; không có → 404 `TABLE_NOT_FOUND`; `tableName = table?.name ?? 'Mang đi'`.
3. `computeOrderTotals` với `restaurant.taxRateBps` (cache restaurant trong request).
4. Payment: CASH bắt buộc `received` và `computeChange`; TRANSFER/CARD bỏ qua `received`, lưu null.
5. `OrderCodeService.next(tx, ...)`, dùng `new Date()` và `restaurant.timezone`.
6. `tx.order.create({ data: { ..., items: { create: [...] }, payment: { create: {...} } }, include: { items: true, payment: true } })`.
7. Audit `ORDER_CREATED` trong cùng transaction, `after = { code, total, paymentMethod }`.
8. Trả `toOrderResponse(order)`; `createdAt` để Date (wire format ISO), replay lưu JSON string cũng ISO nên response nhất quán.

- [ ] **Step 6: Controller + Swagger + chạy test**

`@Post() @HttpCode(201) @Roles(OWNER, MANAGER, CASHIER)`; lấy user từ `@CurrentUser()`, IP/UA từ `@Req()`. Swagger `@ApiHeader({ name: 'Idempotency-Key', required: true })`.

```bash
npm run lint && npm test -- idempotency && npm run test:e2e -- orders-create && npm run build
git add server/src/orders server/src/common/decorators/idempotency-key.decorator.ts server/test/orders-create.e2e-spec.ts server/test/helpers/money.ts server/src/app.module.ts
git commit -m "feat(server): add order creation with server-side pricing, payment and idempotency"
```

### Task 8: Danh sách/chi tiết đơn, huỷ đơn, đọc audit

**Files:**
- Modify: `server/src/orders/orders.controller.ts`, `orders.service.ts`, `dto/orders-query.dto.ts`
- Create: `server/src/audit/audit.controller.ts`, `audit-query.dto.ts`
- Modify: `server/src/audit/audit.module.ts`
- Create: `server/test/orders-query.e2e-spec.ts`, `test/orders-void.e2e-spec.ts`, `test/audit.e2e-spec.ts`

**Interfaces:**
- `GET /orders?from=&to=&status=&tableId=&q=&page=&limit=` → `Paginated<OrderResponse>`; mặc định `page=1`, `limit=20`, max 100; `from` inclusive, `to` exclusive; sort `createdAt desc, id desc`.
- `GET /orders/:id` → `OrderResponse`; khác restaurant → 404.
- `POST /orders/:id/void` body `{ reason: string 3..500 }`; OWNER/MANAGER; đơn COMPLETED → VOIDED; payment COMPLETED → VOIDED; audit `ORDER_VOIDED` với `before`/`after`; đã void → 409 `ORDER_ALREADY_VOIDED`; không có → 404.
- `GET /audit?action=&actorId=&from=&to=&page=&limit=` → `Paginated<AuditResponse>`; OWNER/MANAGER; include `actor: { id, name }`.

- [ ] **Step 1: Viết e2e query/detail trước**

`test/orders-query.e2e-spec.ts`:
- tạo 3 đơn (2 hôm nay, 1 set `createdAt` về hôm qua bằng Prisma) → `GET /orders` mặc định 20, meta `{ page:1, limit:20, total:3, totalPages:1 }`, sort mới nhất trước.
- `limit=1&page=2` → 1 item, meta đúng.
- `limit=101` → 400 `VALIDATION_ERROR`; `page=0` → 400.
- `status=VOIDED` chỉ trả đơn đã huỷ.
- `from`/`to` lọc đúng biên (đơn hôm qua không lọt vào hôm nay).
- `q=` khớp một phần `code`, `tableName`, `cashierName` (case-insensitive).
- `tableId` lọc đúng; `GET /orders/:id` trả đủ items + payment; UUID lạ → 404.
- cashier xem được danh sách/chi tiết (mọi role).

Run: `npm run test:e2e -- orders-query` → FAIL.

- [ ] **Step 2: Implement list/detail**

`OrdersQueryDto`: `from? @IsISO8601`, `to? @IsISO8601`, `status? @IsEnum(OrderStatus)`, `tableId? @IsUUID`, `q? @IsString @MaxLength(100)`, `page? @Type(() => Number) @IsInt @Min(1)`, `limit? @Type(() => Number) @IsInt @Min(1) @Max(100)`.
Where: `restaurantId` từ session; `createdAt` `{ gte: from, lt: to }`; `OR` chứa `code`, `tableName`, `cashierName` với `mode: 'insensitive'`; `include: { items: true, payment: true }`; đếm bằng `$transaction([findMany, count])` hoặc `Promise.all`.

- [ ] **Step 3: Viết e2e void trước**

`test/orders-void.e2e-spec.ts`:
- tạo đơn bằng cashier → cashier gọi void → 403 `FORBIDDEN`.
- manager void với reason `'Khách đổi ý'` → 200; `status VOIDED`, `voidedAt` có, `voidReason` đúng; `payment.status VOIDED`; audit `ORDER_VOIDED` có `before.status COMPLETED`, `after.status VOIDED`.
- void lại → 409 `ORDER_ALREADY_VOIDED`; audit `ORDER_VOIDED` cho đơn đó vẫn chỉ 1 bản ghi.
- reason rỗng/2 ký tự → 400 `VALIDATION_ERROR`; UUID lạ → 404.
- hai request void song song → đúng một 200, một 409; audit đúng 1.

Run: `npm run test:e2e -- orders-void` → FAIL.

- [ ] **Step 4: Implement void an toàn đua**

Trong `$transaction`:
1. `updateMany({ where: { id, restaurantId, status: 'COMPLETED' }, data: { status:'VOIDED', voidedAt: now, voidReason: reason } })`.
2. Nếu `count === 0`: `findFirst` để phân biệt 404 vs 409.
3. Nếu `count === 1`: `payment.updateMany({ where: { orderId: id, status: 'COMPLETED' }, data: { status: 'VOIDED' } })`; audit với before/after; đọc lại order include items/payment.
Không dùng `find` rồi `update` (race).

- [ ] **Step 5: Viết e2e audit trước**

`test/audit.e2e-spec.ts`:
- owner `GET /audit` → 200, có các action từ các test trước; meta phân trang.
- manager đọc được; cashier → 403.
- `action=PIN_LOGIN_FAILED` chỉ trả đúng action; `actorId` lọc đúng; `from`/`to` lọc đúng; `limit=101` → 400.
- response audit không chứa password/PIN/token (assert chuỗi JSON không chứa `pinHash`, `passwordHash`, `restodash.device`).

Run: `npm run test:e2e -- audit` → FAIL.

- [ ] **Step 6: Implement audit controller**

`@Roles(OWNER, MANAGER)`; query `restaurantId` từ session; `include: { actor: { select: { id, name } } }`; sort `createdAt desc, id desc`; `before`/`after` trả nguyên JSON.

- [ ] **Step 7: Chạy + commit**

```bash
npm run lint && npm run test:e2e -- orders-query && npm run test:e2e -- orders-void && npm run test:e2e -- audit && npm run build
git add server/src/orders server/src/audit server/test/orders-query.e2e-spec.ts server/test/orders-void.e2e-spec.ts server/test/audit.e2e-spec.ts
git commit -m "feat(server): add order history, void flow and audit API"
```

---

### Task 9: CI, backup/restore, tài liệu, xác minh cuối

**Files:**
- Create: `.github/workflows/server.yml`, `.github/workflows/web.yml`
- Create: `server/scripts/backup.sh`, `server/scripts/restore.sh`
- Create: `server/Makefile`
- Create: `server/README.md`
- Create: `server/docs/api.http`
- Modify: `PROJECT.md`, `README.md` (root, chỉ thêm link backend)
- Modify: `server/.gitignore` (thêm `backups/`)

**Interfaces:**
- `scripts/backup.sh <db> <file>` và `scripts/restore.sh <db> <file>` chạy qua `docker compose exec -T db`, dùng `pg_dump -Fc` / `pg_restore --clean --if-exists`, không hardcode mật khẩu.
- Make targets: `up`, `down`, `logs`, `migrate`, `seed`, `db-reset`, `test`, `e2e`, `lint`, `build`, `backup`, `restore`.

- [ ] **Step 1: Viết `server.yml`**

Trigger `push`/`pull_request` path `server/**`, workflow `server/**`. Postgres 17 service với `POSTGRES_USER=restodash`, `POSTGRES_PASSWORD=test`, `POSTGRES_DB=restodash_test`, healthcheck. Node 24, cache npm với `server/package-lock.json`. Env `DATABASE_URL` và `TEST_DATABASE_URL` cùng trỏ service, `SESSION_SECRET`/`PIN_PEPPER` >= 32 ký tự, `SWAGGER_ENABLED=false`. Steps: `npm ci` (working-directory `server`), `npx prisma generate`, `npx prisma migrate deploy`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`.

- [ ] **Step 2: Viết `web.yml`**

Node 24, root `npm ci`, `npm run lint`, `npm test`, `npm run build`. Không cần Postgres. Chỉ trigger khi đổi frontend/root.

- [ ] **Step 3: Viết scripts backup/restore**

`backup.sh` kiểm tra 2 tham số, tạo thư mục đích, chạy:

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$1" -Fc' sh "$DB" > "$FILE"
```

`restore.sh`:

```bash
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$1" --clean --if-exists' sh "$DB" < "$FILE"
```

Cả hai `set -euo pipefail`, in đường dẫn/DB đang thao tác, không in secret.

- [ ] **Step 4: Test backup/restore thật**

```bash
docker compose exec -T db createdb -U restodash restodash_restore_test
./scripts/backup.sh restodash_test backups/test.dump
./scripts/restore.sh restodash_restore_test backups/test.dump
docker compose exec -T db psql -U restodash -d restodash_restore_test -tAc 'select count(*) from "MenuItem";'
docker compose exec -T db dropdb -U restodash restodash_restore_test
rm -f backups/test.dump
```

Kỳ vọng: count = 16; `pg_restore` exit 0 (warning về owner có thể bỏ qua, ghi lại nếu có). Thêm `server/backups/` vào `.gitignore`.

- [ ] **Step 5: Viết README, Makefile, api.http**

`server/README.md` gồm: yêu cầu, cài Docker, env, chạy DB/migrate/seed/dev, tài khoản mẫu (ghi rõ chỉ local), danh sách endpoint, auth flow, quy tắc tiền, idempotency, void, backup/restore, test/CI, giới hạn Phase 1 (PIN không lock, menu/bàn chỉ đọc, chưa nối frontend, chưa refund), cách reset DB. Root `README.md` thêm một dòng link `server/README.md`. `PROJECT.md` thêm mục backend ADR (NestJS/Postgres/Prisma/session), roadmap Phase 1 hoàn thành, lệnh chạy và quyết định PIN đã chấp nhận rủi ro.

`docs/api.http` dùng biến `@host = http://localhost:3001/api/v1`, có request login, staff, pin, devices, menu, tables, create order (kèm `Idempotency-Key`), list, void, audit.

- [ ] **Step 6: Xác minh clean-slate local**

```bash
cd server
docker compose down -v
docker compose up -d db
npx prisma migrate deploy
npx prisma db seed
npm run start:dev   # terminal riêng
curl -s http://localhost:3001/api/v1/health
```

Kỳ vọng: health `db: up`; Swagger mở được tại `http://localhost:3001/api/docs`; login owner và tạo đơn mẫu qua Swagger thành công.

- [ ] **Step 7: Chạy toàn bộ cổng kiểm tra**

```bash
cd server
npm run lint
npm test
npm run test:e2e
npm run build

cd ..
npm run lint
npm test        # kỳ vọng 113/113
npm run build
git diff --stat main -- src/ public/ package.json package-lock.json vite.config.ts   # kỳ vọng rỗng
git status --short
```

- [ ] **Step 8: Commit + PR**

```bash
git add .github/workflows server/scripts server/Makefile server/README.md server/docs server/.gitignore PROJECT.md README.md
git commit -m "ci(server): add backend CI, backup scripts and documentation"
git push -u origin feat/backend-foundation
gh pr create --title "Backend foundation (Phase 1)" --body "NestJS + PostgreSQL backend: auth/PIN, devices, menu/tables, orders/payments, void, audit, idempotency, tests, CI. Frontend unchanged."
```

PR body phải có: mục tiêu, phạm vi, ảnh Swagger, lệnh test đã chạy kèm kết quả, rủi ro PIN, checklist DoD. Không merge khi CI đỏ.

---

## Self-review checklist (chạy sau khi hoàn tất plan)

- [ ] Mọi mục trong spec §15 (Definition of Done) có task tương ứng.
- [ ] Không task nào sửa file frontend; root test vẫn 113/113.
- [ ] Tên hàm/type giữa các task khớp: `hashSecret`, `sha256Hex`, `computeOrderTotals`, `OrderCodeService.next`, `IdempotencyService.execute`, `toOrderResponse`, `resetOperationalData`.
- [ ] Review Focus 1–5 đều có test cụ thể trong task tương ứng.
- [ ] Không có bước "TBD", "handle edge cases", hay code body không cần thiết.
- [ ] Seed idempotent; migration tạo đúng bảng `session` cho `connect-pg-simple`.
- [ ] Không có secret trong repo; `.env`, `backups`, generated client bị ignore.
- [ ] Swagger có cookie auth và mọi controller có `@ApiTags`.
- [ ] CI server chạy migrate + e2e trên Postgres service; CI web chạy 113 test.

## Ghi chú thực thi

- Làm tuần tự Task 1 → 9; không nhảy task vì interface của task sau phụ thuộc task trước.
- Commit nhỏ theo từng task; không gộp task 6–8 vào một commit.
- Nếu Prisma 7 CLI/generator khác tài liệu, ưu tiên giữ `moduleFormat = "cjs"`, adapter `PrismaPg`, output `src/generated/prisma`; không nâng Prisma 8 RC.
- Nếu Docker chưa có, dừng và nhờ người dùng cài theo spec §6.2 trước khi tiếp tục.
- Khi gặp lỗi, dùng skill `systematic-debugging`; không sửa frontend để né lỗi backend.

