# Báo cáo hoàn tất module Popup đơn hàng POS dùng chung

- **Ngày:** 2026-11-22
- **Nhánh:** `feat/order-popup` (stacked trên `main` sau module Bàn)
- **Base commit:** `a3aa983` (Task 9 bắt đầu từ đây)
- **Spec:** `docs/superpowers/specs/2026-11-22-order-popup-design.md`
- **Plan:** `docs/superpowers/plans/2026-11-22-order-popup.md`
- **Trạng thái:** Sẵn sàng merge — **Yes** (không có concern chặn)

## Phạm vi đã giao

| Task | Commit | Nội dung |
| --- | --- | --- |
| 0 | `bee27e5`, `06b69b9` | Spec + plan được duyệt; làm rõ luật đơn chờ |
| 1 | `71d4b10`, `6e73733` | Kiểu `OrderStatus`, persist `restodash-pos-v1` **v3 → v4** + migration/test |
| 2 | `5ac80bf`, `3ea20b2` | Action đơn chờ (`savePendingOrder`, `resumePendingOrder`, `payPendingOrder`, `cancelPendingOrder`, `assignTable`); không trùng bản ghi, không mất giỏ |
| 3 | `74bce3c` | Suy ra trạng thái bàn từ đơn chờ (`pendingOrderForTable`, `tableServingState`) |
| 4 | `6e64eef` | `OrderPanel` chỉ quản lý món + tổng tiền + nút **Tạo đơn** |
| 5 | `5b185c9` | `OrderModal` chế độ tạo; xoá `ChargeModal`; router dùng `onCreateOrder` |
| 6 | `2c26d28`, `ae2f4be`, `43c8e13` | Popup chế độ đơn chờ: “Thêm món”/“Huỷ đơn”, tính lại tiền mặt sau khi lưu |
| 7 | `9c1b4e5` | Orders: 3 trạng thái kinh doanh + hành động cho đơn chờ |
| 8 | `a3aa983` | Trang Bàn mở popup chung cho bàn có đơn chờ |
| 9 | (task này) | Tài liệu + polish + full verification |

## Files changed (Task 9)

| File | Thay đổi |
| --- | --- |
| `PROJECT.md` | Phiên bản 2.2 / nhánh `feat/order-popup`; block cập nhật module popup; số test 316 (39 file); persist v4; 3 trạng thái đơn với màu + nhãn; popup dùng chung POS/Bàn/Orders; panel phải chỉ món + tổng + “Tạo đơn”; đơn chờ là đơn thật local, bàn bận tới khi thu/huỷ, “Thêm món” resume, lưu-trước-thu tính lại tiền mặt; ADR-24/25; bảng bất biến; QA smoke 14–15; nhật ký + liên kết báo cáo; thay mọi reference `ChargeModal` còn sống bằng `OrderModal` |
| `README.md` | Tính năng popup/đơn chờ/3 trạng thái; panel phải mô tả lại; persist v4 (giữ key `restodash-pos-v1`, server không đổi); số test 316 |
| `src/pages/POSPage.tsx` | Gợi ý mobile đổi “thanh toán tại quầy” → “tạo đơn tại quầy” (dòng 51) |
| `src/lib/table-state.test.ts` | Đổi tên test “maps pending order items with stable ids and a served default of false” → “treats a pending order item with no served flag as unserved” — tên cũ nhận định assert `lineId` ổn định nhưng helper chỉ trả `state`/`itemCount` |
| `docs/superpowers/reports/2026-11-22-order-popup-report.md` | Báo cáo mới (file này) |

Không đổi production behavior; không đụng server; không đổi brand RestoDash → Serva (task riêng cuối dự án).

## Verification

Tất cả lệnh chạy trên working tree sau khi hoàn tất Task 9. Exit code 0 cho cả 6 lệnh.

| Lệnh | Kết quả |
| --- | --- |
| root `npm test` | **39 file / 316/316 pass** (lặp lại sau chỉnh sửa docs/polish: vẫn 316/316) |
| root `npm run lint` | exit 0; 5 warning `react(only-export-components)` có sẵn trong `src/app/router.tsx` (không phải lỗi mới từ module này) |
| root `npm run build` | pass — `tsc -b` + Vite build; PWA 30 precache entries (~1.8 MiB); 1 warning `INEFFECTIVE_DYNAMIC_IMPORT` (`worker.ts`) đã có từ trước |
| server `npm test` | **11 file / 64/64 pass** |
| server `npm run lint` | exit 0, sạch (`oxlint --type-aware src/ test/`) |
| server `npm run test:e2e` | **13 file / 108/108 pass** (Postgres `restodash_test`, migration + seed chạy tự động) |

### Số test trước / sau

| Suite | Trước module (branch base `c8d00c2`) | Sau module (`a3aa983` + Task 9) | Delta |
| --- | --- | --- | --- |
| Root (`npm test`) | 249 test / 39 file | **316 test / 39 file** | +67 |
| Server unit | 64 / 11 file | 64 / 11 file | 0 |
| Server e2e | 108 / 13 file | 108 / 13 file | 0 |

Root tăng 67 test nhưng số file giữ nguyên 39: `ChargeModal.test.tsx` bị xoá (Task 5), `OrderModal.test.tsx` được thêm; các test mới nằm trong `usePOSStore.test.ts`, `table-state.test.ts`, `OrderPanel.test.tsx`, `OrdersPage.test.tsx`, `TablesPage.test.tsx`, `router.test.tsx`. Task 9 đổi docs + tên 1 test + 1 chuỗi gợi ý nên **không làm đổi số lượng test** (316 → 316). Server xác nhận không đổi mã/schema/e2e.

## Concerns

- Root lint có 5 warning `fast-refresh` trong `router.tsx` (tăng từ 4 so với tài liệu cũ do module thêm export context). Đây là warning có sẵn, không chặn build/test; đã cập nhật con số trong `PROJECT.md`.
- Tài liệu lịch sử (`docs/superpowers/plans/*`, `specs/*`, report FE–BE 20/11) vẫn nhắc `ChargeModal` vì là bản ghi thời điểm thiết kế. Cố ý **giữ nguyên** để không viết lại lịch sử; mọi tài liệu "đang sống" (`PROJECT.md`, `README.md`) đã được cập nhật và ghi rõ `ChargeModal` đã bị xoá.
- E2E server phụ thuộc Postgres + `TEST_DATABASE_URL`; đã chạy đầy đủ trong môi trường này. Không có E2E UI trong repo (nằm ngoài repo theo thiết kế cũ).
- Không đổi brand RestoDash → Serva theo yêu cầu; đây vẫn là task riêng cuối dự án.

## Checklist review bổ sung (đối chiếu spec/plan)

- Lưu chờ rồi sửa rồi lưu lại → vẫn **một** đơn (`savePendingOrder` upsert theo `editingPendingOrderId`, giữ `clientId`) ✅
- Resume (“Thêm món”) không mất giỏ: cất vào `openOrders` trước khi nạp ✅
- Bàn có đơn chờ vẫn bận; huỷ/thu tiền xong bàn rảnh (`isTableBusy`, `tableServingState`) ✅
- `served` sống qua lưu → thêm món → lưu lại → thanh toán (`OrderLineSnapshot.served`, test store) ✅
- Không gửi UUID giả: bàn chưa sync bỏ qua `tableId`; server không nhận đơn chờ ✅
- Badge màu kèm chữ: vàng/đỏ/xanh lá + nhãn (`OrdersPage.StatusBadge`) ✅
- Không đổi server (unit 64, e2e 108 không đổi) ✅
- Test assert hành vi thật (đã sửa tên test không khớp assert) ✅
