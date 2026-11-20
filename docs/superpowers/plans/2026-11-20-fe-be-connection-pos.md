# Kế hoạch kết nối Frontend ↔ Backend — module POS (offline-first)

> **Trạng thái:** ĐỀ XUẤT — chờ chủ dự án duyệt trước khi FE agent / BE agent triển khai.
> **Ngày:** 2026-11-20
> **Phạm vi:** chỉ **module POS** (bán hàng tại quầy). Các module khác để sau khi chủ dự án xác nhận.
> **Tài liệu liên quan:**
> - `PROJECT.md` — sổ tay dự án, ADR và roadmap.
> - `docs/superpowers/specs/2026-11-19-backend-foundation-spec.md` — hợp đồng backend Phase 1.
> - `docs/superpowers/plans/2026-11-19-backend-foundation-plan.md` — plan backend Phase 1.
> - `server/README.md` — cách chạy, tài khoản seed, hợp đồng idempotency.
>
> **Nhánh backend liên quan:** `feat/backend-foundation` (PR #3) — đã có toàn bộ API POS và fix dedupe `clientId`.

---

## 1. Mục tiêu

1. Frontend hiện tại (React + zustand, dữ liệu tĩnh) chạy thật trên backend Phase 1: đăng nhập, lấy thực đơn/bàn từ API, tạo đơn, in hoá đơn, xem lịch sử, huỷ đơn.
2. **Bán được khi mất mạng (offline-first):** giữ nguyên đường ghi local, xếp đơn vào hàng đợi và đồng bộ lên server khi có mạng — không mất đơn, không tạo trùng, không sai tiền.
3. Có **màn hình đăng nhập** đúng mô hình bảo mật của backend: mật khẩu + đăng ký thiết bị + PIN gắn thiết bị.
4. Không thay đổi nghiệp vụ ngoài POS; không thêm số liệu giả; UI tiếng Việt, tiền VND.

**Định nghĩa hoàn thành (POS):** một thu ngân có thể đăng nhập bằng PIN trên thiết bị đã đăng ký, bán hàng online và offline, hoá đơn xuất hiện trong lịch sử (kể cả đơn chờ đồng bộ), mọi đơn offline tự lên server khi có mạng mà không trùng, và huỷ đơn đúng quyền.

---

## 2. Phạm vi

### Trong phạm vi

- Đăng nhập / đăng xuất / chọn nhân viên bằng PIN / đăng ký thiết bị bán hàng.
- POS: chọn bàn, chọn món, giỏ hàng, giảm giá, ghi chú, thanh toán (tiền mặt / chuyển khoản / thẻ), in hoá đơn 80mm.
- Lịch sử đơn gần đây: đơn đã đồng bộ + đơn đang chờ + đơn lỗi; xem lại hoá đơn.
- Huỷ đơn (OWNER/MANAGER) — online và offline.
- Đồng bộ nền: hàng đợi bền vững, retry, chống trùng, xử lý xung đột giá/phiên.
- Cập nhật nhỏ backend để phục vụ đồng bộ (mục 8).

### Ngoài phạm vi (chưa làm lần này)

- CRUD thực đơn/bàn/nhân viên/khách hàng/đặt bàn/báo cáo/chi phí/cài đặt.
- Trang "Đơn hàng" nâng cao, báo cáo doanh thu, quản lý ca, két tiền.
- In nhiệt thật / máy in driver (giữ `@page 80mm` và `window.print()` hiện tại).
- QR gọi món, đặt món từ xa, đa chi nhánh.
- Đồng bộ hai chiều thực đơn (server → local là đủ).
- Chống gian lận nâng cao, khoá PIN, rate limit PIN (giữ nguyên quyết định D-12 đã chấp nhận).

---

## 3. Hiện trạng

### 3.1 Frontend

| Hạng mục | Hiện tại |
| --- | --- |
| Khung app | `src/App.tsx` chuyển trang bằng `useState`, **không router** |
| Dữ liệu | `src/data/menu.ts` (16 món), `src/data/tables.ts` (12 bàn) — tĩnh |
| Trạng thái | `src/store/usePOSStore.ts` — zustand + `localStorage` key `restodash-pos-v1`; giỏ, bàn, giảm giá, ghi chú, nháp, lịch sử |
| Người dùng | Hardcode `ACCOUNT` trong `src/config.ts` |
| Tiền | `src/lib/calc.ts` tính giảm giá + VAT 8% (khớp công thức server) |
| Mã đơn | `src/lib/id.ts` sinh `HD-YYYYMMDD-NNN` cục bộ từ lịch sử máy |
| API layer | **Chưa có** |
| Auth | **Chưa có** |
| PWA | `vite-plugin-pwa` đã cấu hình, precache shell |
| Test | 113 test (vitest + testing-library) đang xanh |
| Deps | react, react-dom, zustand, lucide-react — không router, không HTTP client |

### 3.2 Backend (Phase 1 — nhánh `feat/backend-foundation`, PR #3)

- Prefix `/api/v1`, envelope `{ data, meta? }`; lỗi `{ error: { code, message, details? } }`.
- Auth: phiên cookie `restodash.sid` (30 ngày, rolling), PIN session tuyệt đối 12 giờ; thiết bị cookie `restodash.device` (1 năm). Đăng ký thiết bị chỉ từ phiên mật khẩu.
- `GET /menu`, `GET /tables` (chỉ đọc).
- `POST /orders` bắt buộc `Idempotency-Key`; giá do server chốt; dedupe theo `clientId` (vừa fix, kể cả khi key đổi hoặc request song song).
- `GET /orders` (lọc `from/to/status/tableId/q`, phân trang), `GET /orders/:id`, `POST /orders/:id/void`.
- Audit cho đăng nhập, thiết bị, tạo/huỷ đơn.
- Seed: 3 tài khoản (OWNER/MANAGER/CASHIER), 16 món, 12 bàn; `legacyId` của món/bàn **khớp id tĩnh của frontend** (`ga-nuong`, `ban-1`…), `imageKey` khớp tên file asset.

### 3.3 Khoảng trống phải lấp

| # | Khoảng trống | Xử lý |
| --- | --- | --- |
| G1 | FE không có lớp HTTP, không gửi cookie | Thêm `src/api/*` dùng `fetch` + `credentials: 'include'` |
| G2 | FE không có đăng nhập, user hardcode | Thêm auth store + màn hình đăng nhập + gate ở `App.tsx` |
| G3 | Menu/bàn tĩnh | Đọc từ API, cache local, map `legacyId` |
| G4 | Đơn chỉ nằm local, không lên server | Tạo đơn qua API + hàng đợi offline |
| G5 | `OrderResponse` **không trả `clientId`** | BE-1: thêm `clientId` |
| G6 | Không tra được đơn theo `clientId` khi app crash giữa lúc gửi | BE-2: thêm filter `clientId` cho `GET /orders` |
| G7 | Không có cách phát hiện giá món đổi giữa lúc bán offline và lúc đồng bộ | BE-3: `expectedTotal` + lỗi `PRICE_CHANGED` |
| G8 | Mã đơn offline chưa phải mã chính thức | Dùng mã tạm `OFF-…`, in rõ "chờ đồng bộ", cập nhật mã chính thức sau khi sync |
| G9 | `RESTAURANT.taxRate = 0.08` hardcode | Giữ 8% (khớp seed `taxRateBps=800`); ghi nợ kỹ thuật: sau này lấy từ server |

---

## 4. Quyết định kiến trúc

| ID | Quyết định | Lý do |
| --- | --- | --- |
| D1 | **Offline-first, local là nguồn ghi tạm thời** | Quán phải bán được khi mạng chập chờn; yêu cầu của chủ dự án |
| D2 | `clientId` (UUID) sinh **một lần** ở client, dùng lại cho mọi lần retry; `Idempotency-Key = clientId` | Server đã dedupe theo `clientId`, kể cả khi key đổi; một định danh xuyên suốt dễ đối soát |
| D3 | Hàng đợi **tuần tự FIFO**, lưu `localStorage` key `restodash-orders-v1` | Đơn nhỏ, ít; tuần tự giữ đúng thứ tự và tránh race |
| D4 | **Server là nguồn chân lý về giá**; client gửi `expectedTotal` để phát hiện lệch | Không để thu ngân thu sai tiền khi bảng giá đổi |
| D5 | Đơn lỗi 4xx vào **dead-letter**, không chặn các đơn sau | Một đơn sai dữ liệu không được làm tắc cả hàng đợi |
| D6 | Offline cho phép dùng tiếp nếu thiết bị **đã đăng nhập trước đó**; không lưu PIN/mật khẩu | Cân bằng an toàn và khả dụng; PIN chỉ xác thực online |
| D7 | Mã đơn offline là **mã tạm**, không giả dạng mã chính thức | Không bịa số liệu vận hành |
| D8 | Giữ **không router**; auth gate + state hiện có trong `App.tsx` | Giảm thay đổi, không thêm dependency |
| D9 | Dev dùng **Vite proxy** `/api` → `http://localhost:3000` | Cookie same-origin, tránh cấu hình CORS/cookie phức tạp |
| D10 | Không thêm thư viện HTTP/state mới; dùng `fetch` + zustand sẵn có | Giữ dependency tối thiểu |

## 5. Hợp đồng API dùng cho POS

### 5.1 Quy ước chung

- Base URL dev: `/api/v1` (Vite proxy → `http://localhost:3000`).
- Mọi request gửi kèm cookie: `fetch(url, { credentials: 'include' })`.
- Thành công: `{ "data": ..., "meta"?: ... }`.
- Lỗi: `{ "error": { "code": "...", "message": "...", "details"?: ... } }`.
- Tiền là **số nguyên VND**. Thuế suất server: `taxRateBps = 800` (8%), VAT tính **sau** giảm giá, làm tròn `Math.round`.
- `Idempotency-Key` là header bắt buộc khi tạo đơn; độ dài 1..100.

### 5.2 Auth và thiết bị

| Method | Đường dẫn | Body / query | Kết quả (`data`) | Ghi chú |
| --- | --- | --- | --- | --- |
| `POST` | `/auth/login` | `{ email, password }` | `{ user, authMethod: 'password', expiresAt }` | Đặt cookie phiên 30 ngày; có rate limit |
| `GET` | `/auth/me` | — | `{ user, authMethod, expiresAt }` | Dùng khi khởi động để kiểm tra phiên |
| `POST` | `/auth/logout` | — | `{ success: true }` | Xoá cookie phiên |
| `GET` | `/auth/staff` | — | `[{ id, name, role }]` | **Cần cookie thiết bị**; 401 `DEVICE_REQUIRED` nếu chưa đăng ký |
| `POST` | `/auth/pin` | `{ userId, pin }` | `{ user, authMethod: 'pin', expiresAt }` | Cần cookie thiết bị; PIN 4 chữ số; phiên tuyệt đối 12 giờ |
| `POST` | `/auth/pin/change` | `{ currentPin, newPin }` | `{ success: true }` | Cần phiên |
| `POST` | `/devices` | `{ name }` (1..80) | `DeviceResponse` | **Chỉ OWNER/MANAGER + phiên mật khẩu**; đặt cookie thiết bị 1 năm |
| `GET` | `/devices` | — | `DeviceResponse[]` | Có cờ `current` |
| `DELETE` | `/devices/:id` | — | `{ id, revokedAt }` | OWNER/MANAGER |

`user` = `{ id, name, email, role: 'OWNER'|'MANAGER'|'CASHIER', restaurantId }`.

**Luồng thiết bị:**

1. Máy mới: `GET /auth/staff` trả 401 `DEVICE_REQUIRED`.
2. Chủ/quản lý đăng nhập mật khẩu → `POST /devices { name }` → nhận cookie thiết bị.
3. Từ đó nhân viên đăng nhập bằng PIN: `GET /auth/staff` → chọn người → `POST /auth/pin`.
4. Thiết bị bị thu hồi: `DEVICE_REVOKED` → buộc đăng nhập mật khẩu lại và đăng ký thiết bị mới (nếu có quyền).

### 5.3 Thực đơn và bàn

`GET /menu` → `data`:

```json
{
  "categories": [
    {
      "id": "uuid",
      "name": "mains",
      "sortOrder": 4,
      "items": [
        {
          "id": "uuid-mon",
          "legacyId": "ga-nuong",
          "name": "Gà nướng",
          "description": "Gà nướng than hoa, sốt tiêu chanh",
          "price": 109000,
          "imageKey": "grilled-chicken.webp",
          "available": true,
          "popular": true,
          "sortOrder": 0
        }
      ]
    }
  ]
}
```

- Seed có thêm category `all` và `popular` (rỗng) — **FE bỏ qua** hai category này khi dựng tab.
- `legacyId` khớp id tĩnh FE (`ga-nuong`…), dùng để map ảnh và giữ nguyên logic giỏ hàng.
- `imageKey` khớp tên file trong `src/assets/menu/` → FE dựng map tĩnh `imageKey → import`.
- Chỉ món `available: true` mới gửi lên được (server trả `ORDER_INVALID_ITEM` nếu không).

`GET /tables` → `data`:

```json
[{ "id": "uuid-ban", "legacyId": "ban-1", "name": "Bàn 01", "seats": 2, "zone": null, "sortOrder": 0 }]
```

### 5.4 Đơn hàng

**Tạo đơn** — `POST /orders`, header `Idempotency-Key: <clientId>`:

```json
{
  "clientId": "9f1c2c7e-6a1e-4f3e-9d7a-2b4c8e5f0a11",
  "tableId": "3f1a2b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b",
  "items": [
    { "menuItemId": "7a2b3c4d-5e6f-4a80-9b1c-2d3e4f5a6b7c", "qty": 2, "note": "ít đá" }
  ],
  "discount": { "type": "AMOUNT", "value": 10000 },
  "note": "khách quen",
  "payment": { "method": "CASH", "received": 250000 }
}
```

Quy tắc bắt buộc:

- `items[].menuItemId` là **UUID server**, không phải `legacyId`.
- `items[].qty` nguyên 1..99; tối đa 100 dòng.
- `discount` **bỏ hẳn** khi không giảm giá. `PERCENT` 1..100; `AMOUNT` nguyên dương (server tự kẹp không vượt tạm tính).
- `payment.method`: `CASH` | `TRANSFER` | `CARD`. `CASH` bắt buộc `received ≥ total`; hai phương thức kia **không gửi** `received`.
- `tableId` bỏ trống = mang đi.
- `clientId` là UUID; nếu gửi lại cùng `clientId`, server trả đơn cũ (201) dù `Idempotency-Key` khác.

`data` trả về — `OrderResponse` (sau BE-1 có thêm `clientId`):

```json
{
  "id": "uuid-don",
  "code": "HD-20261120-001",
  "status": "COMPLETED",
  "tableId": "uuid-ban",
  "tableName": "Bàn 01",
  "items": [
    { "menuItemId": "uuid-mon", "name": "Gà nướng", "unitPrice": 109000, "qty": 2, "note": "ít đá" }
  ],
  "subtotal": 218000,
  "discountType": "AMOUNT",
  "discountValue": 10000,
  "discountAmount": 10000,
  "tax": 16640,
  "total": 224640,
  "payment": { "method": "CASH", "amount": 224640, "received": 250000, "change": 25360, "status": "COMPLETED" },
  "note": "khách quen",
  "cashierName": "Thu ngân",
  "createdAt": "2026-11-20T03:00:00.000Z",
  "voidedAt": null,
  "voidReason": null,
  "clientId": "9f1c2c7e-6a1e-4f3e-9d7a-2b4c8e5f0a11"
}
```

> Các UUID trong ví dụ là giá trị minh hoạ hợp lệ; khi triển khai, lấy `id` thật từ `GET /menu` và `GET /tables`.

**Các endpoint còn lại:**

| Method | Đường dẫn | Query / body | Kết quả |
| --- | --- | --- | --- |
| `GET` | `/orders` | `from`, `to` (ISO), `status`, `tableId`, `q`, `page`, `limit` (≤100) | `{ data: OrderResponse[], meta: { page, limit, total, totalPages } }` |
| `GET` | `/orders/:id` | — | `OrderResponse` |
| `POST` | `/orders/:id/void` | `{ reason }` (3..500) | `OrderResponse` đã `VOIDED`; chỉ OWNER/MANAGER |

**Mã lỗi FE phải xử lý:**

| HTTP | `code` | Nghĩa | Hành động FE |
| --- | --- | --- | --- |
| 400 | `ORDER_INVALID_ITEM` | Món không tồn tại/không bán | Dead-letter, báo thu ngân |
| 400 | `ORDER_INVALID_DISCOUNT` | Giảm giá sai | Dead-letter |
| 400 | `ORDER_INVALID_PAYMENT` | Tiền khách đưa thiếu | Chặn tại UI; nếu từ queue → dead-letter |
| 401 | `UNAUTHORIZED` | Hết phiên | Tạm dừng sync, hiện đăng nhập |
| 401 | `DEVICE_REQUIRED` / `DEVICE_REVOKED` | Thiết bị chưa đăng ký/bị thu hồi | Về luồng đăng ký thiết bị |
| 403 | `FORBIDDEN` | Sai quyền (vd. CASHIER huỷ đơn) | Dead-letter, báo lý do |
| 404 | `TABLE_NOT_FOUND` / `ORDER_NOT_FOUND` | Bàn/đơn không còn | Dead-letter hoặc bỏ item |
| 409 | `IDEMPOTENCY_CONFLICT` | Cùng key, payload khác | Dead-letter (lỗi logic) |
| 409 | `ORDER_ALREADY_VOIDED` | Huỷ lần hai | Coi như thành công |
| 409 | `PRICE_CHANGED` | `expectedTotal` lệch giá server (BE-3) | Chuyển `conflict`, cần quản lý xử lý |
| 5xx / mạng | — | Server/đường truyền lỗi | Retry lùi thời gian |

### 5.5 Bổ sung hợp đồng backend (nhỏ, làm trước khi FE vào giai đoạn 4)

| ID | Thay đổi | Chi tiết | Test |
| --- | --- | --- | --- |
| BE-1 | `OrderResponse.clientId: string \| null` | Thêm vào `toOrderResponse`; e2e khẳng định trả đúng | e2e tạo đơn có/không `clientId` |
| BE-2 | `GET /orders?clientId=<uuid>` | Thêm `@IsOptional() @IsUUID() clientId` vào `OrdersQueryDto`, lọc `where.clientId` | e2e: tìm đúng 1 đơn; không lộ đơn quán khác |
| BE-3 | `expectedTotal?: number` trong `CreateOrderDto` | Sau khi tính totals, nếu có và khác `total` → `409 PRICE_CHANGED` với `details: { expectedTotal, actualTotal }`. Không ghi đơn. | e2e: khớp → 201; lệch → 409, không tạo đơn, không tốn mã đơn |

> BE-3 là khuyến nghị bắt buộc để bảo vệ tiền khi bán offline bằng bảng giá cũ. Nếu chủ dự án muốn giữ backend đúng nguyên trạng, phương án dự phòng là FE tự so sánh `total` server trả với `expectedTotal` sau khi sync và gắn cờ `conflict` — nhưng khi đó đơn **đã** được ghi với giá mới, cần quản lý xử lý hậu kiểm.

## 6. Thiết kế offline-first

### 6.1 Phân tầng frontend

```
UI (POSPage, ChargeModal, OrdersPage, LoginPage)
        │
        ▼
Store (zustand + localStorage)
  usePOSStore     ← giỏ, nháp, đơn local + hàng đợi (giữ chung để cập nhật nguyên tử)
  useAuthStore    ← user phiên, trạng thái thiết bị (không lưu mật khẩu/PIN)
  useCatalogStore ← menu/bàn + thời điểm fetch
        │
        ▼
Service layer (src/services/*)
  orderService.create()  → ghi local + enqueue + gọi sync (nếu online)
  orderService.void()    → local + enqueue hoặc gọi API
  catalogService.refresh()
        │
        ▼
API client (src/api/*)  → fetch('/api/v1/...', credentials:'include')
        │
        ▼
Sync worker (src/sync/worker.ts) → POST /orders, POST /orders/:id/void
```

**Nguyên tắc:** UI **không bao giờ** gọi `fetch` trực tiếp và **không** chờ mạng để hoàn tất một đơn. Mọi thao tác ghi đi qua service → store trước, mạng sau.

### 6.2 Đường đọc (menu, bàn)

1. Khi app mở và đã có phiên: gọi song song `GET /menu`, `GET /tables` (timeout 10s).
2. Thành công → ghi `useCatalogStore` + `fetchedAt`, hiển thị bình thường.
3. Lỗi mạng → dùng cache; hiện banner "Đang ngoại tuyến — thực đơn lưu lúc HH:mm DD/MM".
4. Cache rỗng + offline → chặn bán, hiện "Cần kết nối lần đầu để tải thực đơn".
5. Khi có mạng lại → refresh; nếu giá món đổi, **không** tự sửa giỏ đang có, chỉ badge "Giá đã cập nhật" và tính lại từ giá mới cho lần thêm tiếp theo. (Giỏ đang dở giữ giá snapshot tại thời điểm thêm — xem 6.9.)

**Map dữ liệu:**

- `MenuItem.id` (FE) giữ `legacyId`; thêm `serverId` và `imageKey`.
- Ảnh: `const IMAGES: Record<string, string> = { 'grilled-chicken.webp': grilledChicken, ... }` (import tĩnh, Vite yêu cầu).
- Bàn: `TableOption.id` giữ `legacyId`; thêm `serverId`.
- Tab category dùng `CATEGORIES` tĩnh; mỗi món lấy category từ **category cha** trong response (bỏ qua `all`/`popular`).

### 6.3 Đường ghi (đơn hàng) — máy trạng thái

```
Nháp (cart) ──thanh toán──► pending ──gửi thành công──► synced
                              │  ▲
                     lỗi mạng │  │ retry (backoff, vẫn pending)
                              ▼  │
                        chờ thử lại
                              │
                     4xx không retry được
                              ▼
                          failed / conflict
```

- `completeOrder` **luôn** tạo bản ghi local trước, sinh `clientId` + `idempotencyKey` một lần, ghi hàng đợi, xoá giỏ, trả `OrderRecord` ngay (UI in hoá đơn tạm).
- Nếu online: gọi sync ngay (không chặn UI). Nếu offline: chỉ nằm trong queue.
- Khi server trả đơn: cập nhật `serverId`, `code` chính thức, totals server, `syncState='synced'`; hoá đơn đang mở (nếu có) được cập nhật và có thể in lại.

### 6.4 Hàng đợi — định dạng lưu

Lưu trong `usePOSStore` (cùng `localStorage` key, version 2) để mọi thay đổi là một lần ghi nguyên tử:

```ts
type SyncState =
  | 'pending' | 'inflight' | 'synced' | 'failed' | 'conflict'
  | 'legacy'   // đơn có từ trước khi tích hợp, chỉ nằm trên máy

interface SyncItem {
  id: string                 // = clientId với CREATE_ORDER
  kind: 'CREATE_ORDER' | 'VOID_ORDER'
  state: SyncState
  payload: CreateOrderPayload | { orderId: string; reason: string }
  idempotencyKey: string     // sinh 1 lần, không đổi
  expectedTotal?: number
  attempts: number
  nextAttemptAt: number      // epoch ms
  lastError?: { code: string; message: string; status?: number }
  createdAt: number
}

interface LocalOrder extends OrderRecord {
  clientId: string
  serverId?: string
  syncState: SyncState
  provisionalCode: boolean   // true khi code còn là OFF-…
  cashierId: string
}
```

- `PersistedPOS` thêm `queue: SyncItem[]`; `history: LocalOrder[]`.
- **Migration v1 → v2:** lịch sử cũ (không có `clientId`) đánh dấu `syncState:'legacy'`, hiển thị badge "Chỉ trên máy" và **không** đưa vào queue. Không tự đẩy đơn cũ lên server vì thiếu payload/giá snapshot đáng tin.
- Giới hạn: giữ tối đa 500 đơn gần nhất trong `history`, chỉ prune đơn `synced`/`legacy` (không bao giờ prune `pending`/`failed`/`conflict`); queue không giới hạn nhưng cảnh báo nếu > 100.

### 6.5 Đồng bộ — thuật toán

```
flush():
  nếu đang chạy, hoặc offline, hoặc chưa đăng nhập → thoát
  khoá: navigator.locks.request('restodash-sync') nếu có; nếu không, cờ module
  lặp:
    item = item đầu tiên trong queue có state ∈ {pending, inflight}
    (bỏ qua item failed/conflict — chúng chờ quản lý xử lý)
    nếu không có → thoát
    nếu item.state='pending' và nextAttemptAt > now → thoát (hẹn timer)
    state = inflight; lưu
    thử:
      CREATE_ORDER → POST /orders (Idempotency-Key = item.idempotencyKey,
                      body payload + expectedTotal)
      VOID_ORDER   → POST /orders/:id/void
    thành công:
      cập nhật LocalOrder từ response, state='synced', xoá item khỏi queue
    lỗi mạng / 5xx:
      attempts++, nextAttemptAt = now + backoff(attempts), state='pending'; thoát
    lỗi 401:
      state='pending'; dừng hàng đợi; phát sự kiện yêu cầu đăng nhập lại
    lỗi 409 ORDER_ALREADY_VOIDED:
      coi như thành công
    lỗi 4xx khác:
      state='failed' (hoặc 'conflict' với PRICE_CHANGED); giữ trong queue
      để quản lý xử lý; tiếp tục item kế tiếp
```

- **Backoff:** 2s → 5s → 15s → 30s → 60s (giữ 60s), jitter ±20%.
- **Trigger:** sau mỗi đơn; sự kiện `online`; mở app; timer 20s khi queue còn item; nút "Đồng bộ ngay".
- **Một tab:** ADR-12 giả định một thiết bị/một tab. Vẫn thêm cảnh báo qua sự kiện `storage` nếu tab khác ghi queue.
- **Không chặn UI:** mọi lời gọi sync chạy nền; UI chỉ hiện badge trạng thái.

### 6.6 Xử lý lỗi và dead-letter

- `failed` / `conflict` **không** tự retry; hiện trong "Đơn cần xử lý" kèm mã lỗi + thông điệp tiếng Việt.
- Hành động cho quản lý: **Thử lại**, **Bỏ qua** (ẩn khỏi queue, giữ đơn local ở trạng thái `failed` để đối soát), hoặc với `PRICE_CHANGED`: **Chấp nhận giá server** (gửi lại không kèm `expectedTotal`, cập nhật hoá đơn) / **Huỷ đơn**.
- Không bao giờ xoá đơn local khi chưa có kết luận — tránh mất doanh thu.

### 6.7 Crash recovery

Khi app khởi động, với mỗi item `state='inflight'` (app tắt giữa lúc gửi):

1. Gọi `GET /orders?clientId=<id>` (BE-2) và `limit=1`.
2. Có đơn → coi như đã sync, cập nhật local, xoá queue item.
3. Không có → trả về `pending`, gửi lại với **cùng** `Idempotency-Key`/`clientId`.
4. Nếu BE-2 chưa sẵn sàng → fallback: gửi lại `POST /orders` (server dedupe theo `clientId` đã đảm bảo không trùng).

### 6.8 Huỷ đơn offline

- Đơn **chưa sync** (`pending`/`inflight`/`failed`):
  - `pending`/`failed`: xoá item CREATE khỏi queue, đánh dấu đơn local `VOIDED`, không gọi server.
  - `inflight`: đánh dấu "yêu cầu huỷ"; sau khi sync xong (hoặc crash-recovery tìm thấy đơn) mới enqueue VOID.
- Đơn **đã sync**: enqueue `VOID_ORDER` với `serverId` + lý do; server kiểm tra quyền lần nữa.
- UI chỉ cho OWNER/MANAGER bấm huỷ (theo `user.role`); CASHIER bị ẩn nút.
- Huỷ offline khi chưa có mạng vẫn ghi audit local + đồng bộ sau.

### 6.9 Mã đơn và hoá đơn offline

- Đơn offline có mã tạm `OFF-<8 ký tự đầu của clientId>`; hoá đơn in kèm dòng **"Chưa đồng bộ — mã tạm"**.
- Sau khi sync, mã chính thức `HD-YYYYMMDD-NNN` thay thế; lịch sử hiển thị mã chính thức + badge "Đã đồng bộ".
- Không dùng `nextOrderCode()` cũ để sinh mã giả trùng dải `HD-…` của server. Hàm này được giữ cho migration hiển thị đơn cũ, sau đó xoá.
- `createdAt` của đơn local giữ giờ bán thực tế; server trả `createdAt` riêng (giờ sync). UI hiển thị **giờ bán local** cho đơn offline, kèm giờ đồng bộ nếu cần; tuyệt đối không sửa `createdAt` hiển thị thành giờ server.

### 6.10 Giá và chống lệch tiền

- Mỗi dòng giỏ lưu `unitPrice` snapshot tại thời điểm thêm (đã có trong `OrderLineSnapshot` khi thanh toán); khi gửi server chỉ gửi `menuItemId + qty + note`.
- `expectedTotal` = tổng local đã thu. BE-3 so với tổng server; lệch → `PRICE_CHANGED`, **không** ghi đơn.
- UI xử lý: khoá đơn ở `conflict`, hiện bảng so sánh (tổng local vs tổng server, chênh lệch), yêu cầu quản lý quyết định. Không tự thu thêm/hoàn tiền.
- Nếu chưa làm BE-3: sau khi sync, so `response.total` với `expectedTotal`; lệch → badge `conflict` + báo quản lý (đơn đã ghi, cần hậu kiểm).

---

## 7. Đăng nhập và phiên

### 7.1 Màn hình

Một `LoginPage` với 3 trạng thái:

1. **Thiết bị chưa đăng ký** (`DEVICE_REQUIRED` khi gọi `/auth/staff`):
   - Form email + mật khẩu (chỉ OWNER/MANAGER mới đăng ký được).
   - Sau khi đăng nhập: form "Tên thiết bị" (mặc định `POS quầy 1`, cho sửa) → `POST /devices`.
   - Thành công → chuyển sang màn PIN.
2. **Thiết bị đã đăng ký:** danh sách nhân viên (`GET /auth/staff`) dạng thẻ → chọn người → bàn phím PIN 4 số → `POST /auth/pin`.
3. **Đang có phiên:** không hiện login; `App.tsx` render app.

Chi tiết UI: bàn phím số lớn (touch target ≥ 44px), hiện lỗi "PIN không đúng" (server trả 401), nút "Đăng nhập bằng mật khẩu" dự phòng, nút đổi thiết bị chỉ cho OWNER/MANAGER.

### 7.2 Luồng khởi động

```
GET /auth/me (timeout 5s)
 ├─ 200 → set user → render app → refresh catalog → flush queue
 ├─ 401 → gọi GET /auth/staff (không đọc được cookie thiết bị vì httpOnly)
 │        ├─ 200 → LoginPage(PIN, danh sách nhân viên)
 │        └─ 401 DEVICE_REQUIRED → LoginPage(password + đăng ký thiết bị)
 └─ lỗi mạng → nếu lastUser đã lưu → chế độ offline (D6)
                nếu chưa từng đăng nhập → LoginPage, chặn bán
```

- `GET /auth/me` trả `expiresAt`; FE hiển thị cảnh báo khi còn < 30 phút (phiên PIN 12h tuyệt đối).
- Logout: nếu queue còn đơn → **chặn** và giải thích (Q3). Nếu queue rỗng: online thì gọi `POST /auth/logout`; offline thì chỉ xoá phiên local (cookie hết hạn sẽ được server kiểm tra lại khi có mạng).

### 7.3 Chế độ offline và danh tính

- Chỉ cho offline khi `lastUser` tồn tại (đã đăng nhập thành công trên thiết bị này trước đó).
- Offline **không** xác thực lại PIN; đây là đánh đổi đã chọn (D6). Thiết bị POS đặt tại quầy, có khoá máy của HĐH.
- Đơn offline ghi `cashierId` + `cashierName` của người đang đăng nhập lúc bán.
- Khi có mạng: gọi `/auth/me`. Nếu 401 → yêu cầu đăng nhập lại **đúng user** đã tạo các đơn đang chờ; nếu user khác đăng nhập, queue tạm dừng và hiện "Đăng nhập lại tài khoản <tên> để đồng bộ N đơn". Lý do: server ghi `cashierName` theo phiên hiện tại, không nhận `cashierId` từ client.
- Thiết bị bị thu hồi (`DEVICE_REVOKED`): dừng sync, yêu cầu đăng ký lại thiết bị; queue giữ nguyên.

### 7.4 Bảo mật

- Không lưu mật khẩu/PIN/hash trong localStorage. Cookie do server đặt (`httpOnly`, `sameSite=lax`).
- Dev: Vite proxy giữ same-origin. Production: phục vụ FE cùng origin với API hoặc cấu hình `CORS_ORIGINS` + `credentials`.
- Không log payload đơn hàng ra console ở production.

## 8. Thay đổi Frontend

### 8.1 Tệp mới

| Tệp | Nội dung |
| --- | --- |
| `src/api/http.ts` | `request<T>()`: base `/api/v1`, `credentials:'include'`, timeout 10s, parse envelope, ném `ApiError { status, code, message, details }`, phân biệt lỗi mạng (`TypeError`/AbortError) với lỗi HTTP |
| `src/api/auth.ts` | `login`, `me`, `logout`, `staff`, `loginWithPin`, `registerDevice` |
| `src/api/menu.ts` | `getMenu()` |
| `src/api/tables.ts` | `getTables()` |
| `src/api/orders.ts` | `createOrder(payload, idempotencyKey)`, `listOrders(query)`, `getOrder(id)`, `voidOrder(id, reason)` |
| `src/api/types.ts` | Kiểu request/response server (OrderResponse, MenuResponse, …) |
| `src/services/orderService.ts` | Điều phối tạo/huỷ đơn: map payload, ghi local, enqueue, gọi flush (UI không gọi API trực tiếp) |
| `src/lib/catalog-assets.ts` | Map tĩnh `imageKey → import asset` (Vite yêu cầu import tĩnh) |
| `src/stores/useAuthStore.ts` | `user`, `authMethod`, `status: 'checking'\|'authenticated'\|'offline'\|'anonymous'`, `lastOnlineAt`, `lastUser`; actions `refresh`, `loginPassword`, `loginPin`, `registerDevice`, `logout`; persist `restodash-auth-v1` (không chứa secret) |
| `src/stores/useCatalogStore.ts` | `categories`, `items`, `tables`, `fetchedAt`, `source: 'api'\|'cache'`, `loading`, `error`; `refresh()`, `getItemByLegacyId`, `getTableByLegacyId`; persist `restodash-catalog-v1` |
| `src/sync/worker.ts` | Vòng flush, khoá một-tab, trigger online/timer/thủ công |
| `src/sync/backoff.ts` | Hàm thuần `nextDelay(attempts)` + jitter (dễ unit test) |
| `src/sync/errors.ts` | Map `ApiError` → hành động (`retry`/`pause`/`dead`/`conflict`) |
| `src/pages/LoginPage.tsx` | 3 trạng thái: thiết bị chưa đăng ký, chọn nhân viên + PIN, đang kiểm tra phiên |
| `src/components/auth/PinPad.tsx` | Bàn phím 4 số, touch target lớn |
| `src/components/auth/StaffPicker.tsx` | Danh sách nhân viên |
| `src/components/auth/DeviceSetup.tsx` | Đăng nhập mật khẩu + đăng ký thiết bị |
| `src/components/sync/SyncBadge.tsx` | Badge: đang đồng bộ / N đơn chờ / lỗi |
| `src/components/sync/OfflineBanner.tsx` | Banner ngoại tuyến + thời điểm dữ liệu |
| `src/components/sync/PendingOrdersDialog.tsx` | Danh sách đơn lỗi/chờ, thao tác thử lại/bỏ qua/xử lý giá |

### 8.2 Tệp sửa

| Tệp | Thay đổi |
| --- | --- |
| `src/types.ts` | Thêm `serverId`, `clientId`, `syncState`, `provisionalCode`, `cashierId`; mở rộng `OrderRecord`; thêm kiểu `SyncItem`; thêm `CartLine.unitPrice` (snapshot giá lúc thêm món) |
| `src/store/usePOSStore.ts` | Version 2 + migration; thêm `queue`; `completeOrder` sinh `clientId`, tạo `LocalOrder`, enqueue, gọi `flush()` nếu online; thêm `retryItem`, `dismissItem`, `acceptServerPrice`, `markVoidRequested`, `applyServerOrder` |
| `src/pages/POSPage.tsx` | Đọc menu/bàn từ `useCatalogStore` thay vì import tĩnh |
| `src/components/menu/MenuPanel.tsx` | Bỏ `MENU_ITEMS`; nhận items từ catalog; map `imageKey` → asset |
| `src/components/menu/MenuGrid.tsx` | Hiển thị món theo dữ liệu động; disable món `available:false` |
| `src/components/modals/TableModal.tsx` | Bàn từ catalog (`serverId`), giữ `legacyId` cho UI |
| `src/components/modals/ChargeModal.tsx` | Tính totals theo giá snapshot; gọi `completeOrder` mới; hiện trạng thái "đã lưu trên máy, chờ đồng bộ"; truyền `expectedTotal` |
| `src/components/modals/DiscountModal.tsx` | Bỏ giảm giá khi `value=0` (không gửi `discount`) |
| `src/components/modals/ReceiptModal.tsx` | In mã tạm + dòng "Chưa đồng bộ" khi `provisionalCode`; in mã chính thức sau sync |
| `src/pages/OrdersPage.tsx` | Hợp nhất đơn server + local; badge trạng thái; nút huỷ theo role; mở dialog xử lý đơn lỗi |
| `src/components/layout/UserMenu.tsx` | Thay `ACCOUNT` bằng `useAuthStore`; thêm đăng xuất, cảnh báo queue |
| `src/components/layout/TopBar.tsx` / `AppShell.tsx` | Hiển thị `SyncBadge` + `OfflineBanner`; khởi động refresh catalog + flush |
| `src/App.tsx` | Auth gate: `checking` → splash; `anonymous` → `LoginPage`; còn lại → app hiện tại |
| `src/config.ts` | Bỏ `ACCOUNT` (hoặc giữ type, không dùng); thêm `API_BASE = '/api/v1'`; giữ `RESTAURANT` cho hoá đơn |
| `src/data/menu.ts` | Chỉ còn `CATEGORIES` + map ảnh; `MENU_ITEMS` chuyển thành dữ liệu seed/fallback cho test hoặc xoá sau khi test cập nhật |
| `src/data/tables.ts` | Bỏ mảng tĩnh; `tableName` nhận danh sách bàn từ catalog (hoặc snapshot `tableName` trên đơn), không đọc mảng module |
| `src/lib/id.ts` | Giữ `makeId/makeLineId`; bỏ `nextOrderCode` sau migration |
| `vite.config.ts` | Thêm `server.proxy: { '/api': 'http://localhost:3000' }` |
| Test liên quan | Cập nhật theo API/store mới; thêm test cho queue, auth, login, sync |

### 8.3 Hợp đồng nội bộ FE

```ts
// src/api/http.ts
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) { super(message) }
}

// src/services/orderService.ts (hoặc trong usePOSStore)
create(input: ChargeInput): LocalOrder   // đồng bộ, không chờ mạng
voidOrder(order: LocalOrder, reason: string): void
flush(): Promise<void>                   // fire-and-forget từ UI
```

- `ChargeInput` = `{ tableLegacyId, lines, discount, note, method, received }`.
- Service map sang payload server: `menuItemId = catalog.getByLegacyId(line.menuItemId).serverId`; nếu món không còn trong catalog → chặn thanh toán, báo "Món đã ngừng bán".
- `received` chỉ gửi với `CASH`.
- `discount` chỉ gửi khi `value > 0`.
- `expectedTotal` = `calcTotals(...).total` tại thời điểm bán.

### 8.4 UI trạng thái đồng bộ

| Trạng thái | Hiển thị |
| --- | --- |
| Online, queue rỗng | Không badge (hoặc chấm xanh nhỏ) |
| Offline | Banner vàng "Đang ngoại tuyến — đơn sẽ được đồng bộ khi có mạng" |
| Có N đơn chờ | Badge "N đơn chờ đồng bộ" + nút "Đồng bộ ngay" |
| Đang sync | Spinner + "Đang đồng bộ…" |
| Có đơn failed/conflict | Badge đỏ "N đơn cần xử lý" mở `PendingOrdersDialog` |
| Phiên hết hạn | Modal đăng nhập lại, queue giữ nguyên |
| Đơn cũ trước tích hợp | Badge "Chỉ trên máy" (`legacy`), không bao giờ tự sync |

---

## 9. Thay đổi Backend (nhỏ)

Chỉ 3 thay đổi, làm theo TDD, không đụng nghiệp vụ khác.

### BE-1 — `OrderResponse.clientId`

- `server/src/orders/order-response.ts`: thêm `clientId: string | null` và gán `order.clientId`.
- Cập nhật Swagger/README nếu cần.
- Test e2e: tạo đơn có `clientId` → response trả đúng; tạo không có → `null`.

### BE-2 — lọc `GET /orders?clientId=`

- `server/src/orders/dto/orders-query.dto.ts`: `@IsOptional() @IsUUID() clientId?: string`.
- `server/src/orders/orders.service.ts`: thêm `clientId` vào `where` (đã scoped `restaurantId`).
- Test e2e: tìm thấy đúng đơn; `clientId` của quán khác không lộ; UUID sai → 400.

### BE-3 — `expectedTotal` + `PRICE_CHANGED`

- `CreateOrderDto`: `@IsOptional() @IsInt() @Min(0) expectedTotal?: number`.
- Sau `computeOrderTotals`, trước khi sinh mã đơn:
  ```ts
  if (dto.expectedTotal != null && dto.expectedTotal !== totals.total) {
    throw new AppException(409, 'PRICE_CHANGED', 'Giá món đã thay đổi', {
      expectedTotal: dto.expectedTotal,
      actualTotal: totals.total,
    });
  }
  ```
- Không tạo đơn, không tăng `OrderCounter`, không ghi audit `ORDER_CREATED`.
- Test e2e: khớp → 201; lệch → 409 đúng details; retry **cùng `clientId` với `Idempotency-Key` mới** và bỏ `expectedTotal` → tạo được đơn (không trùng).
- Lưu ý: `expectedTotal` nằm trong payload hash của idempotency; nếu client retry với payload khác (bỏ `expectedTotal`) **phải dùng key mới** — FE xử lý bằng cách sinh key mới cho lần "chấp nhận giá server" (vẫn giữ `clientId`).

> Ba thay đổi này không phá vỡ client cũ: `clientId`/`expectedTotal` đều optional, response chỉ thêm trường.

---

## 10. Luồng nghiệp vụ chi tiết

### 10.1 Bán online (bình thường)

1. Thu ngân chọn bàn/món; UI đọc catalog đã cache.
2. `ChargeModal` tính totals local, hiện tiền thối.
3. Bấm "Xác nhận thanh toán":
   - `usePOSStore.completeOrder` tạo `LocalOrder` (`pending`, mã `OFF-…`), xoá giỏ, trả ngay.
   - `flush()` gửi `POST /orders` với `clientId`, `Idempotency-Key = clientId`, `expectedTotal`.
   - Thành công → cập nhật `synced`, mã `HD-…`; modal chuyển "Hoàn tất" và cho xem hoá đơn.
4. Nếu mạng lỗi → giữ `pending`, banner "chờ đồng bộ"; hoá đơn vẫn in được với mã tạm.

### 10.2 Bán offline

1. App phát hiện offline (fetch lỗi hoặc `navigator.onLine=false`).
2. Vẫn cho bán nếu catalog cache + phiên trước đó tồn tại (D6).
3. Mỗi đơn: tạo local + enqueue, không gọi mạng.
4. Hoá đơn in mã tạm + "Chưa đồng bộ".
5. UI hiện "N đơn chờ".

### 10.3 Đồng bộ khi có mạng

1. Sự kiện `online` hoặc timer → `flush()`.
2. Với từng item FIFO: gửi, xử lý kết quả theo bảng lỗi 5.4.
3. Thành công → thay mã tạm bằng mã chính thức, badge "Đã đồng bộ", lưu `serverId`.
4. Lỗi mạng → backoff, thử lại; lỗi 4xx → dead-letter, không chặn đơn sau.
5. Crash giữa chừng → recovery theo 6.7.

### 10.4 Huỷ đơn

1. OWNER/MANAGER mở đơn trong `OrdersPage` → "Huỷ đơn" → nhập lý do 3..500 ký tự.
2. Đơn chưa sync → huỷ local + bỏ queue (hoặc đánh dấu chờ nếu đang inflight).
3. Đơn đã sync → gọi `POST /orders/:id/void`; offline thì enqueue.
4. Thành công → badge `VOIDED`, hoá đơn ghi lý do; CASHIER không thấy nút.

### 10.5 Đăng nhập

1. Máy mới → mật khẩu → đăng ký thiết bị → PIN.
2. Hàng ngày → chọn nhân viên → PIN.
3. Hết phiên giữa ca → modal đăng nhập lại; queue giữ nguyên; yêu cầu đúng user nếu có đơn chờ.
4. Đăng xuất → chặn nếu queue còn đơn; nếu không, gọi API và xoá phiên local.

---

## 11. Phân công và lộ trình

Thứ tự tối ưu: BE-1..3 làm song song với FE giai đoạn 1–3; FE giai đoạn 4 cần BE xong.

| Phase | Agent | Công việc | Phụ thuộc | Điều kiện hoàn thành |
| --- | --- | --- | --- | --- |
| **P0 — BE bổ sung** | BE | BE-1 `clientId` trong response; BE-2 lọc `clientId`; BE-3 `expectedTotal` + `PRICE_CHANGED`; e2e + README/Swagger | PR #3 | 3 e2e mới xanh; 68 e2e cũ vẫn xanh; lint/build sạch |
| **P1 — FE nền tảng** | FE | `src/api/*`, Vite proxy, `useAuthStore`, `LoginPage` (3 trạng thái), auth gate `App.tsx`, logout, hiển thị user thật | P0 không bắt buộc | Máy mới đăng ký được thiết bị; PIN login; reload giữ phiên; 401 quay về login |
| **P2 — Catalog** | FE | `useCatalogStore`, map menu/bàn/ảnh, cache + offline banner, bỏ dữ liệu tĩnh khỏi POS | P1 | Menu/bàn lấy từ API; tắt mạng vẫn hiển thị cache; món `available:false` bị chặn |
| **P3 — Bán online** | FE | `completeOrder` mới, payload mapping, `expectedTotal`, receipt từ `OrderResponse`, lịch sử từ server | P1, P2, BE-1 | Đơn tạo trên server; mã `HD-…`; tổng tiền khớp server; in lại được |
| **P4 — Offline queue** | FE | queue + sync worker + backoff + crash recovery + dead-letter + conflict UI + migration v1→v2 | P3, BE-1..3 | Bán offline → reconnect → lên server đủ, không trùng; kill app giữa lúc gửi không mất/không nhân đôi đơn |
| **P5 — Huỷ đơn & nghiệm thu** | FE + BE | void online/offline, phân quyền, dialog đơn lỗi, chạy ma trận 12.2, sửa lỗi phát sinh | P4 | Toàn bộ ma trận đạt; test/lint/build xanh; review PR |
| **P6 — Dọn nợ** | FE | Xoá `MENU_ITEMS`/`TABLES` tĩnh, `nextOrderCode`, `ACCOUNT`; cập nhật `PROJECT.md` | P5 | Không còn import dữ liệu tĩnh trong luồng POS; tài liệu khớp |

**Quy ước làm việc:**

- Mỗi task theo TDD: viết test đỏ trước, code xanh, refactor.
- Không sửa ngoài phạm vi POS; thay đổi backend phải có e2e.
- Commit nhỏ, message tiếng Anh theo Conventional Commits như hiện tại.
- FE và BE không tự đổi hợp đồng ngoài mục 5.5; nếu cần, cập nhật plan này trước.

---

## 12. Kiểm thử và nghiệm thu

### 12.1 Test tự động

**Frontend (`npm test`):**

- `http`: envelope thành công, lỗi `{error}`, lỗi mạng, timeout, 401.
- `backoff`: dãy delay + jitter trong biên.
- `usePOSStore`: migration v1→v2; `completeOrder` sinh `clientId`/mã tạm; enqueue; apply server; không tạo trùng khi retry; giữ queue khi logout bị chặn.
- `sync worker` (mock fetch): thành công, mạng lỗi → retry cùng key, 401 → pause, 400 → failed, `ORDER_ALREADY_VOIDED` → success, `PRICE_CHANGED` → conflict.
- `useAuthStore`: login mật khẩu/PIN, refresh, offline fallback, logout.
- `LoginPage`: `DEVICE_REQUIRED` hiện form đăng ký; PIN sai hiện lỗi; PIN đúng vào app.
- `ChargeModal`: offline tạo đơn pending, vẫn hiện hoá đơn; online nhận mã server.
- `OrdersPage`: badge chờ/lỗi/đã đồng bộ; nút huỷ chỉ OWNER/MANAGER.
- `catalog`: map `legacyId`/`imageKey`, bỏ category `all`/`popular`, cache.

**Backend (`npm test`, `npm run test:e2e`):**

- BE-1..3 như mục 9.
- Giữ toàn bộ 57 unit + 68 e2e hiện có xanh.

**Lệnh bắt buộc trước khi báo xong:**

```bash
# root
npm test && npm run lint && npm run build
# server
cd server && npm test && npm run test:e2e && npm run lint && npm run build
```

### 12.2 Ma trận kiểm thử thủ công

| # | Kịch bản | Kỳ vọng |
| --- | --- | --- |
| 1 | Máy mới, chưa có cookie thiết bị | Hiện đăng nhập mật khẩu + đăng ký thiết bị |
| 2 | OWNER đăng ký thiết bị → PIN | Vào app; `GET /auth/staff` hoạt động |
| 3 | PIN sai / PIN đúng | Báo lỗi rõ / vào app |
| 4 | Bán tiền mặt online | Đơn `HD-…` trên server; tiền thối đúng; in lại được |
| 5 | Bán chuyển khoản/thẻ | Không gửi `received`; payment đúng method |
| 6 | Giảm giá 0 / 10% / 20.000đ | Không gửi discount / totals khớp server |
| 7 | Tắt mạng, bán 3 đơn | 3 đơn pending, mã `OFF-…`, hoá đơn ghi "chưa đồng bộ" |
| 8 | Bật mạng lại | 3 đơn tự sync FIFO; server có đúng 3 đơn; mã `HD-…` |
| 9 | Kill app khi đang gửi đơn | Mở lại: đơn không mất, không nhân đôi (dedupe `clientId`) |
| 10 | Đổi giá món trên server khi đang offline rồi sync | `PRICE_CHANGED`, đơn vào conflict, không ghi server; quản lý xử lý |
| 11 | OWNER huỷ đơn đã sync (online) | `VOIDED`, audit, payment voided |
| 12 | OWNER huỷ đơn pending (offline) | Đơn local voided, không lên server |
| 13 | CASHIER thử huỷ | Không thấy nút; nếu gọi API → 403 |
| 14 | Hết phiên PIN giữa ca | Modal đăng nhập lại; queue còn nguyên; sync tiếp sau khi đúng user |
| 15 | User khác đăng nhập khi còn đơn chờ | Chặn sync + thông báo đăng nhập lại đúng tài khoản |
| 16 | Thiết bị bị thu hồi | Dừng sync, yêu cầu đăng ký lại; queue giữ nguyên |
| 17 | Đóng/mở tab, reload | Queue + đơn pending còn nguyên |
| 18 | Server 500 / mạng chập chờn | Retry backoff, không mất đơn, không tạo trùng |
| 19 | Món bị `available:false` | Không thêm được; nếu có trong giỏ cũ → chặn thanh toán |
| 20 | Đăng xuất khi còn đơn chờ | Bị chặn kèm giải thích (theo quyết định Q3) |

### 12.3 Môi trường chạy thử

```bash
# Terminal 1 — backend (Postgres local đang chạy)
cd server
npm run start:dev
# Terminal 2 — frontend, proxy /api → localhost:3000
npm run dev
```

- Seed local: `owner@restodash.local / Owner@12345`, PIN `1234`; `manager@… / Manager@12345`, PIN `2345`; `cashier@… / Cashier@12345`, PIN `3456`. **Chỉ dùng khi phát triển.**
- Swagger: `http://localhost:3000/api/docs`.
- E2E backend dùng DB `restodash_test` (global setup tự migrate + seed).

### 12.4 Tiêu chí nghiệm thu POS

- [ ] Đăng nhập mật khẩu → đăng ký thiết bị → PIN hoạt động trên máy mới.
- [ ] Menu/bàn lấy từ server; ảnh và tab hiển thị đúng; cache dùng được offline.
- [ ] Bán online tạo đơn server đúng tiền, đúng mã, in lại được.
- [ ] Bán offline không mất đơn; sync đủ, không trùng, kể cả khi crash.
- [ ] Lệch giá được phát hiện và không âm thầm ghi đơn sai tiền.
- [ ] Huỷ đơn đúng quyền, online và offline.
- [ ] Phiên hết hạn không làm mất queue; đúng người thu ngân được giữ.
- [ ] Không còn số liệu giả trong luồng POS; UI tiếng Việt, VND.
- [ ] Test/lint/build FE + BE xanh.

---

## 13. Rủi ro và câu hỏi mở

### 13.1 Rủi ro

| Rủi ro | Mức | Giảm thiểu |
| --- | --- | --- |
| `localStorage` bị trình duyệt xoá khi thiếu dung lượng | Trung bình | Gọi `navigator.storage.persist()`; giữ queue nhỏ; cảnh báo; PWA cài đặt |
| Giá món đổi khi offline | Cao (tiền) | BE-3 `expectedTotal` + conflict UI |
| Sai danh tính thu ngân khi sync bằng phiên khác | Trung bình | Chặn logout khi còn queue; yêu cầu đúng user |
| Hai tab cùng sync | Thấp (ADR-12) | `navigator.locks` + cảnh báo sự kiện `storage` |
| Đồng hồ máy lệch | Thấp | Server quyết định ngày nghiệp vụ/mã đơn; local chỉ hiển thị |
| `taxRateBps` thay đổi trên server nhưng FE hardcode 8% | Thấp | Ghi nợ: thêm `GET /restaurant` ở phase sau; test so khớp khi seed đổi |
| PIN không khoá/rate limit (D-12) | Đã chấp nhận | Thiết bị đặt tại quầy; thu hồi thiết bị khi mất |
| Mã đơn `padStart(3)` tràn khi >999 đơn/ngày | Thấp | Giữ nguyên; ghi follow-up |
| Cookie thiết bị bị đánh cắp | Thấp | `httpOnly`, thu hồi thiết bị; ngoài phạm vi POS |

### 13.2 Câu hỏi cần chủ dự án chốt trước P4

| ID | Câu hỏi | Đề xuất |
| --- | --- | --- |
| Q1 | Có thêm `expectedTotal` + `409 PRICE_CHANGED` vào backend không? | **Có** — bảo vệ tiền khi bán offline bằng giá cũ |
| Q2 | Cho phép bán offline bằng phiên đã đăng nhập trước đó, không nhập lại PIN? | **Có** — đổi lại: máy POS đặt tại quầy, có khoá HĐH |
| Q3 | Chặn đăng xuất khi còn đơn chưa đồng bộ? | **Có** — tránh sai thu ngân/audit; chỉ cho đăng xuất sau khi sync, hoặc sau khi quản lý đã xử lý/bỏ qua toàn bộ queue |
| Q4 | Hoá đơn offline in mã tạm `OFF-…` kèm dòng "Chưa đồng bộ"? | **Có** — không giả mã chính thức |
| Q5 | Lấy tên/địa chỉ/thuế suất quán từ server ngay phase này? | **Không** — giữ `RESTAURANT` hiện tại; thêm endpoint ở phase sau |

---

## 14. Phụ lục — mapping nhanh FE ↔ BE

| FE | Server | Ghi chú |
| --- | --- | --- |
| `MenuItem.id` (`ga-nuong`) | `MenuItem.legacyId` | Map sang `MenuItem.id` (UUID) khi gửi đơn |
| `MenuItem.image` | `MenuItem.imageKey` | Map tĩnh `imageKey → import asset` |
| `TableOption.id` (`ban-1`) | `Table.legacyId` | Map sang `Table.id` (UUID) khi gửi |
| `PaymentMethod 'cash'` | `'CASH'` | `transfer`→`TRANSFER`, `card`→`CARD` |
| `Discount.type 'amount'` | `'AMOUNT'` | `percent`→`PERCENT`; bỏ discount khi `value=0` |
| `OrderRecord.method` | `PaymentResponse.method` | Map ngược khi hiển thị |
| `OrderRecord.code` | `OrderResponse.code` | Offline: `OFF-…` tạm |
| `OrderRecord.createdAt` (ms) | `OrderResponse.createdAt` (ISO) | Hiển thị giờ bán local cho đơn offline |
| `OrderRecord.cashier` | `OrderResponse.cashierName` | |
| `OrderRecord.received/change` | `PaymentResponse.received/change` | Chỉ có với CASH |
| `OrderRecord.id` | `OrderResponse.id` | Local dùng `clientId` trước khi sync |

### Smoke test nhanh bằng curl (dev)

```bash
BASE=http://localhost:3000/api/v1
curl -s -c /tmp/pos-cookies.txt -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@restodash.local","password":"Owner@12345"}'

curl -s -b /tmp/pos-cookies.txt "$BASE/menu"

curl -s -b /tmp/pos-cookies.txt -X POST "$BASE/orders" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 9f1c2c7e-6a1e-4f3e-9d7a-2b4c8e5f0a11' \
  -d '{
    "clientId":"9f1c2c7e-6a1e-4f3e-9d7a-2b4c8e5f0a11",
    "items":[{"menuItemId":"<uuid-mon>","qty":1}],
    "payment":{"method":"CASH","received":200000},
    "expectedTotal":117720
  }'
```

> Thay `<uuid-mon>` bằng `id` lấy từ `GET /menu`. `expectedTotal` chỉ có sau BE-3.

