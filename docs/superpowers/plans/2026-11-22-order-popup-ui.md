# Chỉnh popup POS (to hơn, gộp chọn bàn + served) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** phóng to `OrderModal`, dồn chọn bàn và tick món đã ra vào popup, bỏ các điều khiển đó khỏi panel phải.

**Architecture:** thêm size `xl` cho `Modal`; thêm 3 action vá bản ghi chờ trong `usePOSStore` (không resume); thiết kế lại `OrderModal` thành 2 cột; `OrderPanel` chỉ giữ quản lý món + tổng.

**Tech Stack:** React 19, Zustand 5, react-router 7, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-22-order-popup-ui-design.md`

## Global Constraints

- Giữ key `restodash-pos-v1` v4; không migration mới; server không đổi.
- Popup mở từ Bàn/Orders không tự resume; chỉ "Thêm món" resume.
- Luật `served` và cảnh báo thanh toán 2 bước giữ nguyên.
- Món đã ra (`served === true`) vẫn khoá sửa/xoá.
- UI tiếng Việt, màu kèm nhãn; responsive; không dependency runtime, không production mock/fake data.
- Mỗi task TDD + full suite + lint + commit.

## Review Focus

- Đổi bàn trong đơn chờ không làm mất món/không tạo đơn mới.
- Tick served trong đơn chờ không đụng giỏ active.
- Panel phải không còn điều khiển chọn bàn/served.
- Popup desktop 2 cột, mobile không tràn.

---

## Task 1: Thêm size `xl` cho Modal

**Files:** `src/components/ui/Modal.tsx`, `src/components/ui/Modal.test.tsx`

- `type ModalSize = 'sm' | 'md' | 'lg' | 'xl'`.
- `sizes.xl = 'max-w-5xl'`.
- Test render `size="xl"` có class `max-w-5xl`; các size cũ không đổi.

**TDD:** write test → run fail → implement → run pass.
**Chạy:** `npx vitest run src/components/ui/Modal.test.tsx`, `npm test`, `npm run lint`.
**Commit:** `feat(ui): add xl modal size`

## Task 2: Action vá đơn chờ trong store

**Files:** `src/store/usePOSStore.ts`, `src/store/usePOSStore.test.ts`

**Produces:**
```ts
setPendingOrderTable: (orderId: string, tableId: string | null) => void
setPendingLineServed: (orderId: string, lineId: string, served: boolean) => void
setAllPendingServed: (orderId: string) => void
```

- Chỉ sửa bản ghi `status === 'pending_payment'` có `id === orderId` trong `history`; giữ nguyên `clientId`, `items` khác, `note`, `discount`, `total`.
- `setPendingOrderTable` cập nhật `tableId` + `tableName` (dùng `resolveTableName`) + `updatedAt`.
- Các action served cập nhật `order.items[i].served`; không đụng `cart`, `openOrders`, `editingPendingOrderId`, không trigger sync.
- Test: đổi bàn giữ nguyên món/tổng; tick 1 dòng; tick tất cả; order `completed` không bị sửa.

**Chạy:** `npx vitest run src/store/usePOSStore.test.ts`, `npm test`, `npm run lint`.
**Commit:** `feat(pos): patch pending orders without resuming`

## Task 3: Thiết kế lại OrderModal

**Files:** `src/components/order/OrderModal.tsx`, `src/components/order/OrderModal.test.tsx`

- `Modal size="xl"`; container `grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]`.
- Cột trái: nút chọn bàn (dùng được **cả 2 chế độ**) + danh sách món.
  - Chế độ tạo: dùng `CartRow` với `showServed` + `onToggleServed` (stepper/xoá vẫn hoạt động); có nút "Chọn tất cả" khi còn món chưa ra.
  - Chế độ chờ: mỗi dòng có nút "Mang ra/Đã ra" gọi `setPendingLineServed(orderId, lineId, ...)`; "Chọn tất cả" gọi `setAllPendingServed(orderId)`; số lượng chỉ đọc.
- Cột phải: ghi chú (tạo)/note hiển thị (chờ), giảm giá, tổng, phương thức thanh toán, tiền mặt, nút.
- Chọn bàn: chế độ tạo dùng local `selectedTableId` + `assignTable` lúc commit như hiện tại; chế độ chờ dùng local state init từ `pendingOrder.tableId`, lưu bằng `setPendingOrderTable(orderId, id)` ngay khi chọn (không cần commit). Chặn bàn có `isTableBusy` khác (ngoại trừ chính bàn của đơn).
- Giữ nguyên save-before-pay, 2-step warning, receipt, reset state.

**TDD:** popup có class max-w-5xl; đổi bàn đơn chờ cập nhật tableName; tick served chế độ tạo và chế độ chờ; "Chọn tất cả" cả 2 chế độ.
**Chạy:** `npx vitest run src/components/order/OrderModal.test.tsx`, `npm test`, `npm run lint`.
**Commit:** `feat(pos): enlarge order modal and move table/served controls into it`

## Task 4: Dọn panel phải

**Files:** `src/components/order/OrderPanel.tsx`, `src/components/order/OrderPanel.test.tsx`, `src/components/order/CartRow.tsx` (nếu cần)

- Bỏ import/render `TableBadge`; bỏ nút "Chọn tất cả" và `countUnserved`; bỏ `showServed`/`onToggleServed` khi render `CartRow`.
- Giữ badge số món, dòng món, tổng, **Tạo đơn**, lưu tạm, xoá đơn.
- `CartRow` giữ props cũ để Task 3 dùng; chỉ không truyền từ `OrderPanel`.
- Cập nhật test: không còn text "Chọn bàn"/"Mang ra"/"Đã ra"/"Chọn tất cả"; vẫn gọi `onCreateOrder`.

**Chạy:** `npx vitest run src/components/order/OrderPanel.test.tsx`, `npm test`, `npm run lint`.
**Commit:** `feat(pos): remove table and served controls from order panel`

## Task 5: Tài liệu + verification

**Files:** `PROJECT.md`, `README.md`, `docs/superpowers/reports/2026-11-22-order-popup-ui-report.md`

- Ghi rõ popup `xl` 2 cột, panel chỉ quản lý món, chọn bàn/served nằm trong popup, đổi bàn đơn chờ.
- Chạy root `npm test`, `npm run lint`, `npm run build`; server `npm test`, `npm run lint`, `npm run test:e2e`. Ghi số trước/sau.

**Commit:** `docs: document popup UI changes`
