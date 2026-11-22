# Popup đơn hàng POS dùng chung — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** gom vòng đời đơn vào một popup dùng chung ở POS/Bàn/Orders, với đơn chờ thanh toán là đơn thật lưu local.

**Architecture:** mở rộng `usePOSStore` (một nguồn dữ liệu) với trạng thái `OrderStatus` và các action cho đơn chờ; thêm `OrderModal` dùng chung 3 chế độ; panel phải chỉ còn quản lý món; server không đổi.

**Tech Stack:** React 19, Zustand 5 + persist, react-router 7, Vitest, oxlint, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-22-order-popup-design.md`

## Global Constraints

- Giữ key `restodash-pos-v1`; nâng version **3 → 4** với migration/test. Không đổi `restodash-catalog-v1`.
- `OrderRecord.status: 'pending_payment' | 'completed' | 'cancelled'`; `syncState` giữ nguyên ý nghĩa đồng bộ.
- `OrderLineSnapshot.served?: boolean`; dòng cũ thiếu `served` hiểu là `false`.
- `editingPendingOrderId: string | null` nằm trong persist; đơn đang soạn không được đếm trùng.
- Không đổi server, không thêm dependency runtime, không fake data/mock trong production code.
- Giữ luật `served`, cảnh báo thanh toán 2 bước, và bàn chưa sync không gửi UUID giả.
- UI tiếng Việt; màu đi kèm nhãn chữ. Mỗi task TDD + full suite + lint trước khi commit.

## Review Focus

- Lưu chờ rồi sửa rồi lưu lại → vẫn **một** đơn, không tạo bản trùng (test Task 2/5).
- Bàn có đơn chờ vẫn bận; huỷ/thu tiền xong bàn rảnh (test Task 3/6).
- Resume đơn chờ khi đang có giỏ khác → không mất giỏ cũ (test Task 2).
- Đơn chờ đang soạn (`editingPendingOrderId`) không hiện trùng trong Orders/bàn (test Task 2/7).
- Thanh toán đơn chờ vẫn giữ cảnh báo món chưa ra và gửi đúng `tableId` (test Task 5).

---

## Task 1: Kiểu dữ liệu và persist v4

**Files:** `src/types.ts`, `src/store/usePOSStore.ts`, `src/store/usePOSStore.test.ts`

**Produces:**
```ts
export type OrderStatus = 'pending_payment' | 'completed' | 'cancelled'
// OrderRecord.status: OrderStatus
// OrderLineSnapshot.served?: boolean
// PersistedPOS.editingPendingOrderId: string | null
```

- `emptyOrder()` không trả `editingPendingOrderId`.
- `isOrder` chấp nhận `status` hợp lệ hoặc thiếu (legacy); `isOrderLine` chấp nhận `served` undefined/boolean.
- `isPersistedPOS` (v4) yêu cầu `editingPendingOrderId` là string|null.
- `safeStorage.getItem`: version 4 + hợp lệ → trả nguyên; version 3 → `{...state, editingPendingOrderId: null, history: state.history.map(h => ({...h, status: h.voided ? 'cancelled' : 'completed'}))}` với `version: 4`; version 2/1 → migration cũ rồi thêm field như trên; còn lại `null`.
- `persist` dùng `version: 4`; `partialize` thêm `editingPendingOrderId`.

**TDD** (thêm vào `describe('persistence')`): v3 upgrade giữ cart/drafts/history/queue và gán status; v4 restore field; corrupt field → mặc định `null`.

**Chạy:** `npx vitest run src/store/usePOSStore.test.ts`, `npm test`, `npm run lint`.
**Commit:** `feat(pos): persist pending order status at v4`

## Task 2: Action đơn chờ trong store

**Files:** `src/store/usePOSStore.ts`, `src/store/usePOSStore.test.ts`

**Produces:**
```ts
assignTable: (tableId: string | null) => void
savePendingOrder: () => LocalOrder | null
resumePendingOrder: (orderId: string) => void
payPendingOrder: (orderId: string, input: CompleteOrderInput) => LocalOrder | null
cancelPendingOrder: (orderId: string) => void
```

- `assignTable` chỉ set `tableId` (không stash cart) — dùng khi popup đổi bàn trước khi lưu.
- `savePendingOrder`: nếu `editingPendingOrderId` trỏ tới bản ghi `pending_payment` thì **cập nhật bản ghi đó** (món/giá/ghi chú/giảm giá/bàn/`updatedAt`), giữ `clientId`; nếu không thì tạo bản ghi mới với `clientId = makeId()`, `code = provisionalCode`, `status: 'pending_payment'`. Sau đó xoá snapshot active, `emptyOrder()`, giữ `editingPendingOrderId = null`.
- `resumePendingOrder(id)`: nếu giỏ active có món thì cất vào `openOrders[orderKey(tableId)]`; nạp món từ đơn chờ (map `OrderLineSnapshot` → `CartLine` với `lineId` ổn định `${order.id}:${index}`), discount, note, `assignTable(order.tableId)`; xoá đơn khỏi `history`; set `editingPendingOrderId = id`.
- `payPendingOrder(id, input)`: tìm đơn `pending_payment`, dùng `clientId` làm id queue item (`CREATE_ORDER`, idempotencyKey = clientId), expectedTotal từ input, đẩy queue, cập nhật đơn thành `completed`, clear `editingPendingOrderId`. Dùng chung `SERVER_METHOD`, `triggerSync`.
- `cancelPendingOrder(id)`: status `cancelled`, bỏ queue item có id = clientId, clear `editingPendingOrderId` nếu trùng.
- `completeOrder` ghi `served: line.served === true` vào `OrderLineSnapshot`.
- `isTableBusy(tableId)` thêm điều kiện: tồn tại đơn `pending_payment` có `tableId` đó và `id !== editingPendingOrderId`.

**TDD** (mới trong `describe('pending orders')`): lưu chờ rồi lưu lại vẫn 1 đơn; lưu chờ xoá giỏ; resume không mất giỏ cũ; resume giữ served/ghi chú/bàn; pay dùng lại clientId và đổi status; cancel bỏ queue; isTableBusy đúng với đơn chờ; completeOrder lưu served.

**Chạy:** `npx vitest run src/store/usePOSStore.test.ts`, `npm test`, `npm run lint`.
**Commit:** `feat(pos): add pending order actions`

## Task 3: Trạng thái bàn từ đơn chờ

**Files:** `src/lib/table-state.ts`, `src/lib/table-state.test.ts`

**Produces:**
```ts
export function pendingOrderForTable(
  history: LocalOrder[], tableId: string, editingPendingOrderId: string | null,
): LocalOrder | undefined

export function tableServingState(
  tableId: string,
  activeTableId: string | null,
  cart: CartLine[],
  openOrders: Record<string, OpenOrderSnapshot>,
  history: LocalOrder[],
  editingPendingOrderId: string | null,
): { state: TableState; itemCount: number }
```

- `pendingOrderForTable` bỏ qua đơn đang soạn và chỉ lấy `status === 'pending_payment'`.
- `tableServingState`: ưu tiên `tableLines(...)` (active/suspended); nếu rỗng và có pending order → map `order.items` thành `CartLine` (`lineId = ${order.id}:${index}`, `served` mặc định false); rồi `tableState(lines)` + tổng qty.

**TDD:** pending order cho bàn đúng; bỏ qua đơn đang soạn; bàn 🔴 khi không có gì; itemCount tổng qty; served hết → `served`.

**Chạy:** `npx vitest run src/lib/table-state.test.ts`, `npm test`.
**Commit:** `feat(tables): derive table state from pending orders`

## Task 4: Panel phải chỉ quản lý món

**Files:** `src/components/order/OrderPanel.tsx`, `src/components/order/OrderPanel.test.tsx`

- Đổi prop `onCharge` → `onCreateOrder: () => void`.
- Bỏ `NoteEditor`, `OrderSummary` khỏi panel; giữ `CartRow`, badge số món, "Chọn tất cả", `TableBadge`, nút nháp, xoá đơn.
- Footer: tổng tiền `{formatVND(totals.total)}` + nút **Tạo đơn** (`aria-label` tương ứng), disabled khi giỏ rỗng; giữ nút lưu tạm.
- Giữ nguyên luật served hiện tại trong `CartRow`.

**TDD:** bấm "Tạo đơn" gọi `onCreateOrder`; không còn text "Thanh toán"/"Ghi chú"/"Giảm giá"; disabled khi rỗng.

**Chạy:** `npx vitest run src/components/order/OrderPanel.test.tsx`, `npm test`.
**Commit:** `feat(pos): simplify order panel to item management`

## Task 5: OrderModal chế độ tạo + thay ChargeModal

**Files:** `src/components/order/OrderModal.tsx` (mới), `src/components/order/OrderModal.test.tsx` (mới), `src/app/router.tsx`, `src/app/router.test.tsx`; xoá `src/components/modals/ChargeModal.tsx` + test nếu logic đã chuyển hết.

**Interface:**
```tsx
interface OrderModalProps {
  open: boolean
  onClose: () => void
  orderId?: string
  tableId?: string | null
  onOpenReceipt?: (order: OrderRecord) => void
}
```

- Chế độ tạo (`orderId` undefined): local `selectedTableId` init từ prop/store; chọn bàn qua `assignTable` khi bấm lưu/thanh toán; giữ nguyên UI payment của `ChargeModal` (method, tiền mặt, quick amounts, cảnh báo 2 bước).
- Nút **Lưu chờ thanh toán** gọi `savePendingOrder()`, toast `Đã lưu đơn chờ thanh toán`, đóng.
- Nút **Thanh toán** gọi `completeOrder`, hiển thị màn hình thành công + `onOpenReceipt`.
- Router: thay `ChargeModal` bằng `OrderModal`; context đổi `onCharge` → `onCreateOrder`.

**TDD:** lưu chờ tạo bản ghi pending và xoá giỏ; thanh toán vẫn hỏi 2 bước khi còn món chưa ra; chọn bàn không làm mất món; đóng/mở lại reset warning.

**Chạy:** `npx vitest run src/components/order/OrderModal.test.tsx src/app/router.test.tsx`, `npm test`.
**Commit:** `feat(pos): add shared order modal and replace charge modal`

## Task 6: Popup chế độ đơn chờ

**Files:** `src/components/order/OrderModal.tsx`, `src/components/order/OrderModal.test.tsx`

- Khi có `orderId`: trên open gọi `resumePendingOrder(orderId)`; hiện thông tin bàn, món, `served`, ghi chú, giảm giá của đơn đó.
- Nút **Thêm món**: `onClose()` + điều hướng POS (component nhận `onAddItems?: () => void`), giữ giỏ active đã nạp.
- Nút **Huỷ đơn**: `ConfirmModal` title `Huỷ đơn?`, xác nhận → `cancelPendingOrder`, toast `Đã huỷ đơn`.
- Nút **Thanh toán**: `payPendingOrder(orderId, payment)`, vẫn cảnh báo món chưa ra, mở receipt.
- Reset state khi đổi `orderId` hoặc `open`.

**TDD:** mở đơn chờ nạp đúng món/ghi chú; thêm món gọi callback; huỷ đổi status và trả bàn; thanh toán dùng clientId cũ.

**Chạy:** `npx vitest run src/components/order/OrderModal.test.tsx`, `npm test`.
**Commit:** `feat(pos): support pending orders in shared modal`

## Task 7: Orders page 3 trạng thái

**Files:** `src/pages/OrdersPage.tsx`, `src/pages/OrdersPage.test.tsx`

- Badge: `pending_payment` → `tone="gold"` text `Chờ thanh toán`; `cancelled` → `tone="negative"` text `Đã huỷ`; `completed` → `tone="positive"` text `Thành công`. Ngừng dùng `syncState` cho badge chính (giữ hiển thị phụ nếu cần).
- Đơn chờ: nút **Thanh toán** mở `OrderModal` với `orderId`, nút **Huỷ** gọi `cancelPendingOrder`.
- Đơn thành công: giữ nút in lại; đơn huỷ: không có nút thu tiền.

**TDD:** 3 badge đúng màu/tên; bấm thanh toán mở popup đúng đơn; huỷ đơn chờ đổi badge.

**Chạy:** `npx vitest run src/pages/OrdersPage.test.tsx`, `npm test`.
**Commit:** `feat(orders): show business status and pending actions`

## Task 8: Trang Bàn dùng popup chung

**Files:** `src/pages/TablesPage.tsx`, `src/pages/TablesPage.test.tsx`, `src/app/router.tsx`

- Dùng `tableServingState` (Task 3) thay cho `tableLines`+`tableState`.
- Bàn 🔴: giữ hành vi chọn bàn rồi vào POS (dùng `assignTable` thay `switchTable` để không stash giỏ rỗng).
- Bàn 🟡/🟢 có pending order: bấm → mở `OrderModal` với `orderId` của đơn đó (pendingOrderForTable). Bàn có giỏ active/suspended: giữ `switchTable` rồi vào POS.
- Thêm test điều hướng từ Bàn vào popup.

**TDD:** bàn chờ mở đúng popup; bàn trống vẫn vào POS; màu/nhãn 3 trạng thái không đổi.

**Chạy:** `npx vitest run src/pages/TablesPage.test.tsx`, `npm test`.
**Commit:** `feat(tables): open shared order modal from tables page`

## Task 9: Tài liệu + verification

**Files:** `PROJECT.md`, `README.md`, báo cáo `docs/superpowers/reports/2026-11-22-order-popup-report.md`

- Cập nhật mô tả popup dùng chung, 3 trạng thái đơn, bàn bận tới khi thu tiền, persist v4.
- Chạy `npm test`, `npm run lint`, `npm run build`, server `npm test`, `npm run lint`, `npm run test:e2e`; ghi số test trước/sau.

**Commit:** `docs: document shared order popup module`

---

## Review Focus bổ sung

Reviewer từng task kiểm tra: không tạo bản trùng khi lưu lại đơn đang soạn; không mất giỏ khi resume; bàn bận đúng; served sống qua các vòng; không gửi UUID giả; badge màu kèm chữ; không đổi server; test assert hành vi thật.
