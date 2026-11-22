# Giảm/xoá món trong popup đơn chờ — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** cho phép giảm số lượng / xoá món chưa ra ngay trong popup đơn chờ, đồng bộ active cart và tổng tiền.

**Architecture:** thêm 2 action vá history trong `usePOSStore`; `OrderModal` dùng `CartRow` cho chế độ chờ.

**Tech Stack:** React 19, Zustand 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-22-edit-pending-items-design.md`

## Global Constraints

- Giữ persist v4/key `restodash-pos-v1`; server không đổi.
- Món `served === true` không đổi qty/xoá được.
- `lineId = ${order.id}:${index}`; chỉ vá bản ghi `pending_payment` có id khớp.
- Khi `editingPendingOrderId === orderId`, đồng bộ thay đổi vào giỏ active.
- Tính lại totals bằng `calcTotals`; UI tiếng Việt; không dependency/mock production.

## Task 1: Store actions

**Files:** `src/store/usePOSStore.ts`, `src/store/usePOSStore.test.ts`

**Produces:**
```ts
setPendingLineQty: (orderId: string, lineId: string, qty: number) => void
removePendingLine: (orderId: string, lineId: string) => void
```

- No-op nếu đơn không phải `pending_payment`, không khớp id, hoặc dòng đó `served === true`.
- `qty <= 0` → xoá dòng; `qty >= 1` → cập nhật qty.
- Tính lại `subtotal/discountAmount/tax/total` bằng `calcTotals` với `order.discount ?? {type:'amount', value: order.discountAmount}`; cập nhật `updatedAt`.
- Khi đang soạn đơn đó: áp cùng thay đổi vào `cart` (patch qty hoặc filter dòng) để `savePendingOrder()` không ghi đè.
- Test: giảm qty, xoá dòng, served no-op, totals đúng, đồng bộ active cart.

**Commit:** `feat(pos): edit quantities and remove lines in pending orders`

## Task 2: OrderModal dùng CartRow cho đơn chờ

**Files:** `src/components/order/OrderModal.tsx`, `src/components/order/OrderModal.test.tsx`

- Thay đoạn render custom pending items bằng `CartRow` với `showServed` và callbacks gọi 3 action pending (qty ±/xoá/served).
- `viewTotals` ở chế độ chờ tính từ `pendingItems` + `viewDiscount` + `calcTotals` (không dùng field tổng cũ đã lưu).
- Giữ nút "Chọn tất cả", cảnh báo 2 bước, save-before-pay, receipt; reset `receivedInput` khi tổng đổi.
- Bỏ chú thích "Số lượng cố định…".
- Test: stepper/xoá hoạt động trong popup chờ; served bị khoá; tổng cập nhật.

**Commit:** `feat(pos): allow editing pending order lines in modal`

## Task 3: Docs + verification

**Files:** `PROJECT.md`, `README.md`, `docs/superpowers/reports/2026-11-22-edit-pending-items-report.md`

- Ghi rõ giảm/xoá món chưa ra trong popup; món đã ra vẫn khoá.
- Chạy root `npm test`/`npm run lint`/`npm run build`; server `npm test`/`npm run lint`/`npm run test:e2e`; ghi số.

**Commit:** `docs: document pending item editing`
