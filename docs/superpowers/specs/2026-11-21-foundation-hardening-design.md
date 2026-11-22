# Thiết kế — Gia cố nền tảng (hash router + ErrorBoundary + sửa "Xoá đơn")

> **Ngày:** 2026-11-21
> **Trạng thái:** ĐÃ CHỐT (chủ dự án duyệt React Router hash + phạm vi). Chờ chuyển thành plan triển khai.
> **Phạm vi:** pass nền tảng frontend. Không đụng nghiệp vụ POS/đơn/hoá đơn, không đụng server. Đây là bước dọn đường trước module **Bàn**.
> **Tài liệu liên quan:** `PROJECT.md` (§7.2 P0, ADR-02, §8.2), `docs/superpowers/plans/2026-11-21-foundation-hardening.md`.

---

## 1. Mục tiêu

Ba việc trong PROJECT.md §7.2 được liệt kê là "P0 — trước khi mở module mới":

1. **Router + deep-link** — mỗi trang có URL, back/forward và deep-link hoạt động.
2. **ErrorBoundary** — lỗi render ngoài dự kiến không làm trắng toàn app.
3. **Sửa "Xoá đơn"** — có xác nhận và reset **toàn bộ** đơn hiện tại, không chỉ giỏ.

Sau pass này, module **Bàn** (Phase 2) có thể bắt đầu trên nền điều hướng đã gọn.

## 2. Quyết định đã chốt

| ID | Quyết định | Lý do |
| --- | --- | --- |
| D1 | Dùng **React Router v7**, **hash routing** (`createHashRouter`). | 11 trang + sắp có role guard/code-split theo route; hash giữ được "deploy hosting tĩnh bất kỳ" (path-based sẽ 404 khi deep-link nếu host không rewrite về `index.html`). |
| D2 | Đặt `RouterProvider` **sau** auth gate; hash nằm ở `window.location`. | Deep-link (vd `#/menu`) được giữ nguyên qua màn đăng nhập. |
| D3 | `ErrorBoundary` là **class component**, chỉ bắt **lỗi render**. | Lỗi async/rejected promise vẫn đi toast/console như hiện tại; không "nuốt" lỗi. |
| D4 | "Xoá đơn" mở `ConfirmModal` rồi gọi `resetOrder()` xoá `cart` + `tableId` + `discount` + `note`. | Đơn sau không thừa hưởng bàn/giảm giá/ghi chú của đơn trước. |
| D5 | Cập nhật **ADR-02** trong `PROJECT.md` (bỏ "không router"). | Đổi một quyết định đã chốt phải ghi lại lý do (PROJECT.md §5). |

## 3. Hiện trạng (điểm chạm)

- `src/App.tsx`: `function POSApp()` giữ `useState<PageId>('pos')` và truyền `onNavigate` xuống; **không có URL**, không back/forward.
- `src/components/layout/AppShell.tsx`: nhận `activePage`, `onNavigate`, `sidebarOpen`, `onToggleSidebar`, `searchSlot`, `children`; gọi `useCatalogStore.refresh()` + `startSync()` khi mount.
- `Sidebar` / `TopBar` / `GlobalSearch` nhận `onNavigate(page)`; `PlaceholderPage` nhận `onBackToPos()`.
- `src/store/usePOSStore.ts`: `clearCart: () => set({ cart: [] })`; initial state `cart: []`, `tableId: null`, `discount: { type: 'amount', value: 0 }`, `note: ''`.
- `src/components/order/OrderPanel.tsx`: nút "Xoá đơn" gọi `handleClear()` → `clearCart()` trực tiếp, **không xác nhận**.
- Chưa có `react-router`, chưa có `ErrorBoundary`. CI (`web.yml` + `server.yml`) và lớp service (`src/api/*`) đã có.
- `vite.config.ts` PWA `navigateFallback: index.html` — **giữ nguyên**.

## 4. Route table

```text
#/             → redirect  #/pos
#/pos          → POSPage
#/orders       → OrdersPage
#/menu         → MenuPage
#/<pageId>     → PlaceholderPage  (PageId hợp lệ khác trong APP_PAGES)
#/<không có>   → redirect  #/pos
```

`pageFromPath(pathname)` suy `PageId` từ URL (khớp `APP_PAGES.id`, mặc định `'pos'`) để Sidebar highlight đúng.

## 5. Thay đổi

1. Thêm dependency `react-router` (v7).
2. **Tạo** `src/app/router.tsx` — `pageFromPath`, `AppLayout` (giữ state shell/modal, bọc `AppShell` + `<Outlet context>`), `createHashRouter`.
3. **Sửa** `src/App.tsx` — khi authenticated render `<RouterProvider/>`; bọc `ErrorBoundary`.
4. **Tạo** `src/components/ErrorBoundary.tsx` — fallback tiếng Việt + "Tải lại" + "Về POS".
5. **Sửa** `src/store/usePOSStore.ts` — thêm `resetOrder(): void`, bỏ `clearCart`.
6. **Sửa** `src/components/order/OrderPanel.tsx` — `ConfirmModal` + `resetOrder`.
7. Tests + cập nhật `PROJECT.md` / `README.md`.

## 6. Ngoài phạm vi

- Không làm module Bàn.
- Không thêm phân quyền theo route (chỉ dọn đường).
- Không đổi persist key `restodash-pos-v1` / version `2`.
- Không đụng backend (`server/`).

## 7. Rủi ro

| Rủi ro | Hậu quả | Giảm thiểu |
| --- | --- | --- |
| Router chạm nhiều component điều hướng | Regression điều hướng | Component test cho từng route + smoke thủ công |
| Hash-based deep-link hiểu nhầm | Tưởng hỏng khi gõ `/orders` (không `#`) | Ghi rõ trong README |
| ErrorBoundary bắt nhầm lỗi async | Che lỗi thật | Chỉ dùng `getDerivedStateFromError` (render), không bọc promise |
| `resetOrder` xoá nhầm khi user chưa xác nhận | Mất đơn đang làm | `ConfirmModal` chặn trước khi gọi |
