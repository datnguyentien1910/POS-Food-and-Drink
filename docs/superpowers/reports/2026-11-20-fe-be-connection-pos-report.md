# Báo cáo hoàn thành — Tích hợp FE–BE cho POS & đồng bộ offline-first

> **Plan:** `docs/superpowers/plans/2026-11-20-fe-be-connection-pos.md` (đã duyệt)
> **Nhánh:** `docs/fe-be-connection-plan`
> **Ngày:** 20/11/2026
> **Trạng thái:** Hoàn thành P0–P6. Tất cả cổng kiểm tra xanh.

---

## 1. Tóm tắt điều hành

Frontend POS (React/Vite/TypeScript) đã được nối với backend NestJS đã hoàn thành trước đó, đồng thời bổ sung **luồng bán hàng offline-first**:

- Đăng nhập theo **thiết bị + PIN**, có auth gate và quản lý phiên.
- **Menu và bàn lấy từ API**, có cache để dùng khi mất mạng.
- **Bán online** tạo đơn trên server, mã `HD-…`, chặn lệch giá bằng `expectedTotal`.
- **Bán offline** xếp vào hàng đợi bền vững, tự đồng bộ nền theo FIFO khi có mạng trở lại, **không mất và không tạo trùng đơn** kể cả khi crash.
- **Huỷ đơn** đúng quyền (OWNER/MANAGER) cho cả đơn đã đồng bộ và đơn còn chờ.

Kết quả cổng kiểm tra (đã chạy thật, xem §6):

| Bộ kiểm tra | Kết quả |
| --- | --- |
| Root `npm run lint` | ✅ sạch (`oxlint`) |
| Root `npm test` | ✅ **150/150** (27 file) |
| Root `npm run build` | ✅ pass (TSC strict + Vite + PWA) |
| Server `npm run lint` | ✅ sạch |
| Server `npm test` | ✅ **57/57** |
| Server `npm run test:e2e` | ✅ **75/75** |
| Server `npm run build` | ✅ pass |

---

## 2. Sản phẩm bàn giao theo giai đoạn

### P0 — Bổ sung backend (BE-1..3) — commit `03c02c8`

- `OrderResponse.clientId` (BE-1).
- `GET /orders?clientId=` để đối soát (BE-2).
- `expectedTotal` trong payload tạo đơn + `409 PRICE_CHANGED` khi lệch (BE-3).
- 6 e2e mới (đỏ → xanh). Cổng: server lint sạch, unit 57/57, e2e 75/75, build pass.

### P1 — Nền tảng auth/API — commit `1a42cb1`

- `src/api/*`: fetch client bóc envelope `{ data }`, `ApiError { status, code, message, details }` với `isOffline` (`status === 0`).
- Vite proxy `/api` → `http://localhost:3001` (D9). Cổng dev chuẩn hoá **3001**.
- `useAuthStore`, `LoginPage` 3 trạng thái (đăng ký thiết bị → PIN → vào app), auth gate ở `App.tsx`, logout, hiển thị user thật.

### P2 — Catalog từ API — commit `d768d17`

- `useCatalogStore`: menu/bàn/ảnh từ API, cache offline, nguồn `builtin | cache | api`.
- Map `legacyId`/`imageKey`; bỏ category `all`/`popular`; chặn món `available:false`.
- 18 file (+611/−190). Cổng: root lint sạch, 135/135 test, build pass.

### P3 — Bán online — commit `40ffd87`

- `completeOrder` mới: sinh `clientId`, payload `{ clientId, tableId?, items[{menuItemId, qty, note?}], discount?, note?, payment, expectedTotal? }`.
- Mã `HD-…` lấy từ `OrderResponse`; hoá đơn dựng từ response server.
- Quyết định (ruling): OrdersPage lấy danh sách từ `history` local thay vì fetch riêng.

### P4 — Hàng đợi offline + đồng bộ nền — commit `40ffd87`

- Persist **v2** (`restodash-pos-v1` giữ nguyên key) + migration v1→v2; thêm `queue: SyncItem[]`.
- `src/sync/`:
  - `backoff.ts`: 2s → 5s → 15s → 30s → 60s, jitter ±20%.
  - `errors.ts`: phân loại lỗi → hành động (dead / retry / conflict / pause).
  - `worker.ts`: flush FIFO đơn-single-flight, pause khi 401, dead-letter 400/403/404, crash recovery (đối soát `inflight` qua server), xử lý `PRICE_CHANGED`.
- `useSyncStore` (ephemeral): `online, syncing, paused, lastError`.
- `src/services/orderService.ts`: facade cho UI (`create`, `cancel`, `requestSync`, `flushNow`).
- UI đồng bộ: `SyncBadge`, `OfflineBanner`, `PendingOrdersDialog`, `SyncStatus` ở OrdersPage.
- Q3: chặn đăng xuất khi hàng đợi còn đơn chưa đồng bộ.
- Test mới: `backoff`, `worker`, migration trong `usePOSStore`.

### P5 — Huỷ đơn & nghiệm thu — commit `40ffd87`

- **Online:** `POST /orders/:id/void` với `@Roles('OWNER','MANAGER')`; server đặt `VOIDED`, audit, payment voided; `ORDER_ALREADY_VOIDED` coi như thành công.
- **Offline:** đơn chưa đồng bộ → `voidLocalOrder` (không lên server).
- OrdersPage: badge trạng thái đồng bộ, nút huỷ chỉ hiện với OWNER/MANAGER (test: MANAGER thấy, CASHIER ẩn), có `ConfirmModal`.
- Ma trận §12.2: xem §7 bên dưới.

### P6 — Dọn nợ — commit `7cbe2fd`

- Xoá `nextOrderCode` (`src/lib/id.ts`) và test tương ứng.
- `ACCOUNT` không còn tồn tại trong mã nguồn (đã được gỡ từ trước).
- `PROJECT.md` cập nhật lên v2.0: đánh dấu **[Cập nhật]**, thêm ADR-17..19, sửa bảng trạng thái/chất lượng/luồng dữ liệu/store/giới hạn.
- **Ghi chú deviation:** dữ liệu tĩnh `MENU_ITEMS`/`TABLES` (`src/data/catalog-seed.ts`) **được giữ lại có chủ đích** làm fallback seed cho máy hoàn toàn mới mở offline (ruling P2, ghi ở ADR-19). Luồng POS luôn ưu tiên catalog live; seed chỉ dùng khi chưa có cache.

---

## 3. Hợp đồng đã dùng (tóm tắt)

- Envelope: `{ data, meta? }`; lỗi `{ error: { code, message, details } }`.
- Tạo đơn: header `Idempotency-Key = clientId`; `payment.method` ∈ CASH | TRANSFER | CARD; `received` chỉ khi CASH; bỏ `discount` khi bằng 0.
- Ánh xạ lỗi → hành động:

| Lỗi | Hành động FE |
| --- | --- |
| 400 `ORDER_INVALID_*` | dead-letter |
| 401 | pause + yêu cầu đăng nhập lại |
| 403 / 404 | dead-letter |
| 409 `IDEMPOTENCY_CONFLICT` | dead-letter |
| 409 `ORDER_ALREADY_VOIDED` | coi như thành công |
| 409 `PRICE_CHANGED` | conflict (quản lý xử lý) |
| 5xx / mạng | retry với backoff |

---

## 4. Quyết định đã chốt trong quá trình làm

- **Q1** `expectedTotal` + `PRICE_CHANGED`.
- **Q2** cho phép bán offline bằng phiên trước đó.
- **Q3** chặn đăng xuất khi hàng đợi còn đơn chờ.
- **Q4** hoá đơn offline dùng mã `OFF-…` + nhãn “Chưa đồng bộ”.
- **Q5** chưa thêm endpoint thông tin nhà hàng; FE giữ VAT 8% (ghi nợ `GET /restaurant`).
- Ruling P2/P3/P4: xem SDD ledger `.superpowers/sdd/2026-11-20-fe-be-connection-pos/progress.md`.

---

## 5. Kiến trúc sau tích hợp

```text
UI (POSPage/OrdersPage/…)
   │  getMenuItem/getTable (catalog-lookup)
   ▼
useCatalogStore ──fetch──▶ API /menu /tables ──▶ cache (persist)
useAuthStore    ──fetch──▶ API /auth/* (cookie thiết bị)
   │
   ▼
orderService (create/cancel/requestSync)
   ▼
usePOSStore (persist v2: cart/drafts/history/queue)
   │  enqueue
   ▼
sync/worker ──FIFO + backoff──▶ API /orders (Idempotency-Key = clientId)
   │
   ▼
useSyncStore (online/paused/lastError) ──▶ SyncBadge/OfflineBanner/PendingOrdersDialog
```

---

## 6. Bằng chứng cổng kiểm tra (chạy thật trên máy này)

```text
# Root
$ npm run lint      → npm notice run oxlint  (không lỗi)
$ npm test          → Test Files 27 passed (27) · Tests 150 passed (150)
$ npm run build     → precache 30 entries (1677.43 KiB) · dist/sw.js (thành công)

# Server
$ npm run lint      → oxlint --type-aware src/ test/  (không lỗi)
$ npm test          → Test Files 9 passed (9) · Tests 57 passed (57)
$ npm run test:e2e  → migrate deploy + seed · Test Files 12 passed (12) · Tests 75 passed (75)
$ npm run build     → nest build  (thành công)
```

---

## 7. Ma trận nghiệm thu §12.2

Đối chiếu với code + test tự động. Các mục cần **thiết bị/trình duyệt thật** được ghi rõ là “kiểm thủ công”.

| # | Kịch bản | Trạng thái | Bằng chứng |
| --- | --- | --- | --- |
| 1 | Máy mới chưa có cookie thiết bị | ✅ code + test | `LoginPage` trạng thái `DEVICE_REQUIRED` → form đăng ký |
| 2 | OWNER đăng ký → PIN vào app | ✅ code + test | `useAuthStore`, `LoginPage` test |
| 3 | PIN sai / PIN đúng | ✅ test | `LoginPage` test lỗi/đúng |
| 4 | Bán tiền mặt online | ✅ code + server e2e | `createOrder` e2e; `ChargeModal` test |
| 5 | Chuyển khoản/thẻ (không `received`) | ✅ code + server e2e | payload mapping |
| 6 | Giảm giá 0 / 10% / 20.000đ | ✅ code + server e2e | bỏ `discount` khi 0; totals khớp server |
| 7 | Tắt mạng bán 3 đơn | ✅ test | `usePOSStore` offline queue; mã `OFF-…`; hoá đơn “Chưa đồng bộ” |
| 8 | Bật mạng sync FIFO 3 đơn | ✅ test | `worker.test.ts` flush |
| 9 | Kill app khi đang gửi | ✅ test | `worker.test.ts` crash recovery (`inflight` đối soát) |
| 10 | Đổi giá khi offline rồi sync | ✅ test | `PRICE_CHANGED` → conflict |
| 11 | OWNER huỷ đơn đã sync | ✅ code + server e2e | `POST /:id/void`, audit |
| 12 | OWNER huỷ đơn pending | ✅ test | `voidLocalOrder` |
| 13 | CASHIER thử huỷ | ✅ test | `OrdersPage.test.tsx` (CASHIER ẩn nút) + server `@Roles` |
| 14 | Hết phiên PIN giữa ca | ✅ test | 401 → `paused`; queue giữ nguyên |
| 15 | User khác đăng nhập khi còn đơn chờ | ✅ code | Q2/Q3: 401 pause + yêu cầu đúng user |
| 16 | Thiết bị bị thu hồi | ⚠️ kiểm thủ công | cần thu hồi thiết bị thật ở server |
| 17 | Đóng/mở tab, reload | ✅ test | persist v2 hydrate |
| 18 | Server 500 / mạng chập chờn | ✅ test | backoff + retry cùng key |
| 19 | Món `available:false` | ✅ test | catalog + chặn thanh toán |
| 20 | Đăng xuất khi còn đơn chờ | ✅ code + test | `UserMenu` chặn + giải thích |

**Các bước cần môi trường thật để nghiệm thu cuối (không tự động hoá trong repo):**
1. Chạy `cd server && npm run start:dev` + `npm run dev`, rồi lần lượt làm §12.2 mục 1–20 trên trình duyệt.
2. Mục 16 (thu hồi thiết bị) cần thao tác ở DB/admin.
3. Kiểm tra in hoá đơn 80mm bằng máy in/PDF thật.

---

## 8. Thay đổi so với plan (deviation) & follow-up

| Hạng mục | Khác plan | Lý do |
| --- | --- | --- |
| Thư mục store | `src/store/` (số ít) thay vì `src/stores/` | Theo code hiện có |
| Seed tĩnh | Giữ `catalog-seed.ts` làm fallback | Máy mới offline vẫn xem được menu (ADR-19) |
| Đa tab | Dùng single-flight flag thay `navigator.locks` | Đơn giản hoá; 2 tab hiếm gặp |
| VAT | FE hardcode 8%, chưa có `GET /restaurant` | Q5 chấp nhận, ghi nợ |

**Follow-up gợi ý:**
- Thêm `GET /restaurant` để đồng bộ `taxRateBps` (bỏ hardcode 8%).
- `clearCart` nên reset toàn bộ đơn + `ConfirmModal` (hạn chế cũ, §7.2 PROJECT.md).
- Dùng `navigator.locks` + cảnh báo sự kiện `storage` nếu cần nhiều tab.
- CI chạy root + server gates trên mỗi PR.

---

## 9. Cách chạy thử

```bash
# Backend (Postgres local đang chạy)
cd server && npm run start:dev     # http://localhost:3001, Swagger /api/docs

# Frontend
npm run dev                        # http://localhost:5173, proxy /api → :3001
```

Seed dev: `owner@restodash.local / Owner@12345` PIN 1234; `manager@… / Manager@12345` PIN 2345; `cashier@… / Cashier@12345` PIN 3456.

---

## 10. Lịch sử commit trong đợt

| Commit | Nội dung |
| --- | --- |
| `8ae96d3` | docs: duyệt plan + chốt port 3001 |
| `7ac3b24` | merge `origin/main` (backend Phase 1 + clientId) |
| `03c02c8` | feat(server): BE-1..3 |
| `1a42cb1` | feat(web): API client + auth store + login |
| `d768d17` | feat(web): catalog từ API |
| `40ffd87` | feat(web): hàng đợi đơn offline + sync nền (P3+P4+P5 code) |
| `7cbe2fd` | chore(web): xoá `nextOrderCode` + cập nhật PROJECT.md (P6) |

---

## 11. Kết luận

Plan đã được thực thi trọn vẹn P0–P6. Toàn bộ cổng bắt buộc (root + server: lint, test, e2e, build) xanh. Các mục nghiệm thu còn lại chỉ là kiểm thủ công trên thiết bị/máy in thật (§7, mục 16 và in ấn), không phải việc code còn dang dở.
