# Module Bàn — thiết kế

- **Ngày:** 2026-11-22
- **Trạng thái:** đã duyệt trong hội thoại; chờ plan + thực thi
- **Nhánh nền:** `feat/foundation-hardening` @ `d5edb00` (hash router, ErrorBoundary, `resetOrder`)
- **Phạm vi:** module Bàn (Phase 2), frontend + backend bàn
- **Liên quan:** `PROJECT.md` §8.4, `docs/superpowers/plans/2026-11-21-foundation-hardening.md`

## 1. Mục tiêu và lý do

Quán hiện chỉ có POS bán lẻ một giỏ. Nhân viên chưa có cách:

- nhìn thấy bàn nào đang trống / đang phục vụ / đã mang món ra;
- mở một bàn, gọi món nhiều vòng, theo dõi món nào còn phải làm;
- thêm/xoá bàn khi quán thay đổi sơ đồ;
- chỉ xuất hoá đơn khi khách thanh toán.

Module này biến POS thành luồng **phục vụ tại bàn** đúng nghĩa: mỗi bàn giữ một đơn mở qua nhiều vòng gọi món, trạng thái bàn suy ra từ đơn, và bàn về trống sau khi thanh toán.

## 2. Mục tiêu

- Trang `#/tables`: lưới bàn theo khu vực, 3 trạng thái màu + nhãn chữ/icon.
- Thêm/xoá bàn; thêm/xoá chạy được khi mất mạng và đồng bộ server sau.
- Bấm bàn → POS với bàn đó; thêm món nhiều vòng; món cũ giữ trạng thái đã ra.
- Tick “đã mang ra” theo từng món + “Chọn tất cả”.
- Thanh toán đơn mở → hoá đơn hiện có → bàn về trống ngay.
- Dữ liệu bàn (tên/chỗ/khu vực) là dữ liệu chung, lưu server.

## 3. Ngoài phạm vi (non-goals)

- Sơ đồ bàn kéo-thả / toạ độ / mặt bằng.
- Chuyển bàn, gộp bàn, tách hoá đơn.
- Đặt bàn trước, khách tự chọn bàn.
- Web khách order trước (dự án riêng, sau).
- Màn hình bếp (KDS) riêng.
- Huỷ món **đã mang ra** (chính sách A: khoá).
- Đồng bộ trạng thái bàn giữa nhiều máy (chỉ 1 máy POS).

## 4. Anti-goals

- Không lưu cứng trạng thái bàn thành cột riêng rồi để lệch với đơn.
- Không tạo màn nhập món thứ hai ngoài POS.
- Không chặn bán khi mất mạng.
- Không đổi persist key `restodash-pos-v1`.
- Không đụng module menu/thanh toán ngoài phần cần thiết.

## 5. Ràng buộc

- Offline-first: thao tác bàn/đơn mở phải chạy khi mất mạng; đồng bộ khi có mạng.
- Chỉ **một máy POS** thao tác → không cần xử lý xung đột nhiều máy.
- Server hiện chỉ có `OrderStatus.COMPLETED | VOIDED`; **đơn mở không lên server** trong module này (option B).
- Persist `restodash-pos-v1`: version **2 → 3** (thêm `openOrders`), có migration + test.
- UI tiếng Việt; giữ PWA `navigateFallback: index.html`.
- Quyền: OWNER/MANAGER thêm/xoá bàn; mọi role đổi trạng thái món/thanh toán.
- Không thêm dependency runtime.

## 6. Các phương án đã cân nhắc

### 6.1 Mức đồng bộ server

| Phương án | Bàn | Đơn mở | Nhận xét |
| --- | --- | --- | --- |
| A. Local hoàn toàn | local | local | Nhanh nhất nhưng mất danh sách bàn khi xoá dữ liệu trình duyệt; server không có bàn mới. |
| **B. Bàn sync, đơn mở local** | server + cache offline | local | **Chọn.** Cân bằng; đúng ràng buộc offline + 1 máy. |
| C. Mirror toàn bộ | server | server + queue | Nặng nhất; lợi ích chưa rõ khi chỉ 1 máy. |

**Quyết định: B.** Pre-order web sau này sẽ nằm trên server; POS tải về và chuyển thành đơn mở local khi khách đến. Không cần open-order server ngay.

### 6.2 Mô hình nhiều đơn mở

- **Swap model (chọn):** `usePOSStore` giữ **một đơn active** (`cart/tableId/discount/note`) + `openOrders` cho các bàn đang treo. Đổi bàn = cất đơn hiện tại, nạp đơn bàn mới. Tái dùng nguyên `OrderPanel`, `MenuPanel`, `ChargeModal`.
- **Hai store / hai màn nhập món:** sạch hơn về domain nhưng phải dựng lại UI gọi món và tăng regression. Loại.

### 6.3 Trạng thái bàn

- **Suy ra từ đơn (chọn):** không có đơn → trống; có món chưa ra → chưa phục vụ; tất cả đã ra → đã phục vụ.
- **Lưu cứng:** dễ lệch khi sửa đơn. Loại.

### 6.4 Chính sách món đã mang ra

- **A (chọn):** khoá sửa/xoá; muốn đổi thì thêm món mới; món đã ra vẫn tính tiền.
- B: cho huỷ + lý do + không tính tiền (phase sau).
- C: cho huỷ nhưng vẫn tính tiền.

## 7. Trạng thái bàn

```
🔴 Trống      : không có đơn mở / đơn rỗng
🟡 Chưa phục vụ: đơn mở có ≥1 món served !== true
🟢 Đã phục vụ : đơn mở có ≥1 món và mọi món served === true
```

- Bàn 🟢 mà thêm món → món mới `served=false` → tự về 🟡.
- Thanh toán xong → đơn đóng → 🔴 ngay; không có trạng thái “cần dọn”.
- Màu chỉ là phụ; mỗi thẻ luôn có nhãn chữ + icon.

## 8. Mô hình dữ liệu

### 8.1 Client

```ts
// src/types.ts
interface CartLine {
  lineId: string
  menuItemId: string
  qty: number
  unitPrice?: number
  name?: string
  /** true = đã mang ra; false/undefined = còn phải làm. */
  served?: boolean
}

interface OpenOrderSnapshot {
  cart: CartLine[]
  discount: Discount
  note: string
  updatedAt: number
}

interface TableOption {
  id: string              // legacy id, ổn định local
  name: string
  seats: number
  serverId?: string       // UUID server khi đã sync
  zone?: string | null
  active?: boolean
  syncState?: 'synced' | 'pending'
}

type TableState = 'empty' | 'pending' | 'served'
```

### 8.2 Persist `restodash-pos-v1` v3

Thêm `openOrders: Record<string, OpenOrderSnapshot>` vào `PersistedPOS` và `partialize`.

Khóa của `openOrders`:

- bàn: `tableId` (legacy id, ví dụ `ban-5`);
- mang về: hằng số `__takeaway__`.

Migration:

- v1 → `migrateV1` (như hiện tại) + `openOrders: {}` → v3.
- v2 → giữ state hợp lệ + `openOrders: {}` → v3.
- v3 → validate như hiện tại + `openOrders` (nếu hỏng thì `{}`).
- `served` thiếu trên dòng cũ được hiểu là `false`.

### 8.3 Server `Table`

Thêm cột:

```prisma
isActive Boolean @default(true)
```

- `GET /api/v1/tables`: chỉ `isActive: true`, sort `sortOrder, name`.
- `POST /api/v1/tables` (OWNER/MANAGER): tạo bàn; idempotent theo `legacyId`.
- `DELETE /api/v1/tables/:id` (OWNER/MANAGER): xoá mềm (`isActive=false`), idempotent.
- Không thêm trạng thái bàn lên server.

`POST` body:

```ts
{
  legacyId?: string   // id local do POS sinh; dùng để idempotent
  name: string        // 1..50
  seats: number       // 1..50
  zone?: string | null // <= 50
  sortOrder?: number  // >= 0; mặc định max+1
}
```

- Tên không trùng (không phân biệt hoa/thường) giữa các bàn `isActive`.
- Nếu `legacyId` đã tồn tại: cập nhật name/seats/zone/sortOrder, set `isActive=true`, trả bàn đó (idempotent).
- `DELETE` không tìm thấy → 404 `TABLE_NOT_FOUND`.
- Xoá bàn đã xoá → 204 (idempotent).
- Không audit log cho bàn (giữ đơn giản; menu mới có audit).

### 8.4 Offline queue bàn (client)

`useCatalogStore` thêm:

```ts
type TableOp =
  | { id: string; kind: 'CREATE_TABLE'; tableId: string; payload: CreateTableInput; createdAt: number }
  | { id: string; kind: 'DELETE_TABLE'; tableId: string; serverId?: string; createdAt: number }

pendingTableOps: TableOp[]
createTable: (input: { name: string; seats: number; zone?: string | null }) => { ok: boolean; reason?: 'DUPLICATE_NAME' | 'INVALID' }
deleteTable: (tableId: string) => { ok: boolean; reason?: 'OPEN_ORDER' | 'NOT_FOUND' }
flushTableOps: () => Promise<void>
```

- `createTable`: sinh `id = 'ban-' + makeId()`; thêm local với `syncState: 'pending'`; enqueue CREATE.
- `deleteTable`: chặn nếu bàn đang có đơn mở (active hoặc trong `openOrders`); nếu bàn chưa từng sync, bỏ CREATE op và xoá local; nếu đã sync, enqueue DELETE.
- `flushTableOps`: chạy tuần tự; lỗi mạng → dừng, giữ queue; 409/404 với create/delete → coi như thành công (idempotent).
- `refresh`: flush trước (nếu được), rồi GET; merge server với pending create (giữ bàn local chưa có trên server) và pending delete (ẩn bàn đã xoá).
- Gọi `flushTableOps` trong `AppShell` sau `refresh()` và khi `window online`.

## 9. Store `usePOSStore` — API mới

```ts
setLineServed: (lineId: string, served: boolean) => void
setAllServed: () => void
switchTable: (tableId: string | null) => void
openOrders: Record<string, OpenOrderSnapshot>
```

Quy tắc:

- `addItem(menuItemId)`:
  - nếu có dòng cùng `menuItemId` và `served !== true` → `qty + 1`;
  - nếu dòng cùng `menuItemId` đã `served === true` → **tạo dòng mới** `served: false`;
  - dòng mới luôn `served: false`.
- `increment`/`decrement`/`removeItem`: **no-op** nếu `line.served === true`.
- `setLineServed`: chỉ đổi dòng tương ứng.
- `setAllServed`: set `served = true` cho mọi dòng.
- `switchTable(next)`:
  1. `currentKey = tableId ?? '__takeaway__'`, `nextKey = next ?? '__takeaway__'`.
  2. Nếu bằng nhau → chỉ set `tableId`.
  3. Nếu `cart.length > 0` → lưu `openOrders[currentKey] = { cart, discount, note, updatedAt }`.
  4. Nếu `openOrders[nextKey]` có → nạp vào `cart/discount/note`, xoá khỏi map.
  5. Ngược lại → `emptyOrder()`.
  6. `tableId = next`.
- `setTable` giữ nguyên tên nhưng gọi `switchTable` (TableModal không phải sửa).
- `resetOrder`: xoá đơn active **và** `openOrders[key(tableId)]`.
- `completeOrder`: sau khi tạo order + `emptyOrder()`, xoá `openOrders[key(tableId)]`.
- `saveDraft`/`loadDraft`: xoá snapshot của bàn active trước/sau khi thay đơn để tránh trùng.

## 10. UI

### 10.1 `TablesPage`

- Route `#/tables` (thay placeholder).
- Nhóm theo `zone ?? 'Khác'`.
- Thẻ bàn:
  - tên + số chỗ;
  - badge trạng thái: `Trống` (negative/đỏ), `Chưa phục vụ` (gold/vàng), `Đã phục vụ` (positive/xanh);
  - icon `Armchair` + chấm màu;
  - nếu `syncState === 'pending'`: badge nhỏ “Chờ đồng bộ”.
- Bấm thẻ → `switchTable(id)` + `navigate('/pos')`.
- Nút “Thêm bàn” (OWNER/MANAGER) → `TableFormModal`.
- Menu xoá trên thẻ (OWNER/MANAGER) → `ConfirmModal`; disabled nếu trạng thái ≠ `empty`.
- Empty state khi chưa có bàn.

### 10.2 `TableFormModal`

- Trường: tên (bắt buộc), số chỗ (1..50), khu vực (tuỳ chọn).
- Validate trùng tên với bàn active; báo lỗi inline.
- Submit → `createTable` → toast “Đã thêm bàn”; đóng.

### 10.3 `OrderPanel` / `CartRow`

- Khi `tableId !== null`:
  - mỗi dòng có toggle “Đã mang ra” (`aria-pressed`), icon `Check`;
  - dòng `served=true`: hiện badge “Đã ra”, **ẩn/disable** stepper + nút xoá;
  - header có nút “Chọn tất cả” khi còn món chưa ra.
- Khi mang về (`tableId === null`): không hiện các điều khiển served.
- Nút “Xoá đơn” vẫn reset toàn bộ đơn của bàn đang mở.

### 10.4 `ChargeModal`

- Nếu `tableId !== null` và còn món `served !== true`:
  - lần bấm “Xác nhận thanh toán” đầu tiên **không** thanh toán; hiện cảnh báo “Còn N món chưa mang ra.” và đổi nút thành “Vẫn thanh toán”;
  - bấm lần hai mới gọi `completeOrder`.
- Cảnh báo reset khi đóng modal / đổi giỏ.

## 11. Luồng chính

### Mở bàn và gọi món

1. `#/tables` → bấm bàn 🔴.
2. `switchTable(id)` → `#/pos`; panel đơn trống có badge bàn.
3. Chọn món → dòng `served=false` → bàn 🟡.
4. Tick từng món hoặc “Chọn tất cả” → 🟢.

### Gọi thêm

1. Bàn 🟢 → bấm bàn → POS.
2. Thêm món → dòng mới `served=false` → 🟡; món cũ vẫn tick.
3. Tick món mới → 🟢.

### Thanh toán

1. Bấm “Thanh toán” → `ChargeModal`.
2. Nếu còn món chưa ra → cảnh báo hai bước.
3. Xác nhận → `completeOrder` (queue sync như hiện tại) → hoá đơn.
4. `emptyOrder()` + xoá snapshot → bàn 🔴.

### Thêm/xoá bàn

1. “Thêm bàn” → modal → lưu local ngay + enqueue; toast.
2. Xoá bàn trống → confirm → xoá local + enqueue (hoặc bỏ CREATE nếu chưa sync).
3. Mất mạng: vẫn thao tác; có mạng lại → flush.

## 12. Edge cases

- Đổi bàn khi đang có đơn: tự cất, không mất; không cần confirm.
- Đơn rỗng không được lưu vào `openOrders`.
- Bàn 🟢 + thêm món trùng tên đã ra → dòng mới, không cộng dồn.
- Bàn có món đã ra: không sửa/xoá dòng đó.
- Xoá bàn đang có đơn mở → chặn.
- Xoá bàn đã từng bán → xoá mềm; hoá đơn cũ vẫn giữ `tableName`.
- Bàn chưa sync mà thanh toán → `tableId` bỏ trống, `tableName` vẫn gửi.
- Tên bàn trùng (không phân biệt hoa/thường) → chặn.
- Persist hỏng / version lạ → về mặc định, không trắng app.
- Thanh toán khi còn món chưa ra → cho phép sau cảnh báo.
- Refresh catalog khi có pending ops → không làm mất bàn local.

## 13. Kiểm thử

- **Store:** served rules, addItem trùng, switch/suspend/resume, takeaway slot, reset/complete cleanup, migration v1/v2 → v3.
- **Table state:** 3 trạng thái, chuyển trạng thái khi thêm/tick món.
- **UI:** grid/nhãn/màu, click bàn, quyền thêm/xoá, modal validate, tick + chọn tất cả, cảnh báo thanh toán.
- **Table ops:** create/delete offline, flush, merge refresh, idempotent, chặn xoá bàn có đơn.
- **Server e2e:** GET active, POST quyền + idempotent + trùng tên, DELETE mềm + quyền + 404.
- **Router:** `#/tables` render `TablesPage`, không phải placeholder.

## 14. Tương thích và triển khai

- Migration Prisma mới: `table_is_active`.
- Seed giữ 12 bàn; tất cả `isActive=true`.
- Persist migration v3 chạy tự động; dữ liệu v2 giữ nguyên giỏ/nháp/lịch sử.
- Docs: `PROJECT.md` + `README.md` cập nhật sau cùng.
- PR base: `feat/foundation-hardening` (stacked) cho tới khi nhánh nền merge.

## 15. Ghi chú cho web order trước (ngoài phạm vi)

Thiết kế này không chặn dự án sau:

- Pre-order sẽ nằm trên server với kênh `TAKEAWAY | DINE_IN`, `scheduledAt`, thông tin khách, trạng thái `PENDING | DONE | CANCELLED`.
- Mang về: hàng đợi sort `scheduledAt` rồi `createdAt`, nhân viên bấm Done.
- Dùng tại chỗ: khách không chọn bàn; POS tải pre-order về và chuyển thành đơn mở local khi khách đến.
- Module Bàn hiện tại không cần thêm trạng thái “đặt trước”.
