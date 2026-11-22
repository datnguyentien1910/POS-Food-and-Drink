# Báo cáo hoàn tất — Sửa món chưa ra trong popup đơn chờ

- **Ngày:** 2026-11-22
- **Nhánh:** `feat/order-popup`
- **Base trước thay đổi:** `86d420a` (baseline test root 331)
- **Commit cuối behavior:** `d94e889`
- **Spec:** `docs/superpowers/specs/2026-11-22-edit-pending-items-design.md`
- **Plan:** `docs/superpowers/plans/2026-11-22-edit-pending-items.md`
- **Trạng thái:** Sẵn sàng merge — **Yes** (không có concern chặn)

## Phạm vi đã giao

| Task | Commit | Nội dung |
| --- | --- | --- |
| 0 | `86d420a` | Spec + plan được duyệt (không đổi behavior) |
| 1 | `470b2b4` | Store: `setPendingLineQty`, `removePendingLine`, `patchPendingLine`; 12 test mới |
| 2 | `d94e889` | `OrderModal` dùng `CartRow` cho đơn chờ; tổng/tiền thu tính lại; `pendingLineIndex`, `editedLineIds`; 3 test mới + cập nhật fixture |
| 3 | (task này) | Tài liệu (`PROJECT.md`, `README.md`, báo cáo này) + full verification |

## Hành vi sau thay đổi

- Trong **popup Chi tiết đơn chờ** mở từ **Bàn/Orders**, món **chưa mang ra** giờ có stepper **− / +** và nút **Xoá** ngay trong popup (dùng chung `CartRow` với giỏ POS). Bỏ chú thích “Số lượng cố định · dùng ‘Thêm món’ để chỉnh sửa”.
- **Tổng tiền và tiền thu/thối tính lại ngay** khi sửa món: `viewTotals = calcTotals(pendingItems, viewDiscount, RESTAURANT.taxRate)` thay vì dùng field tổng đã lưu (có thể cũ); `receivedInput` tự làm mới theo tổng mới.
- **Món đã ra (`served: true`) vẫn khoá** giảm/tăng/xoá theo policy A (ADR-22) ở mọi nơi; trong popup chỉ toggle được “Mang ra/Đã ra”. **“Thêm món” vẫn có** để thêm món mới (resume đơn về giỏ POS).
- Store `setPendingLineQty(orderId, lineId, qty)` (qty ≤ 0 → xoá dòng) và `removePendingLine(orderId, lineId)` chỉ vá bản ghi `pending_payment` có id khớp; no-op với dòng đã ra, đơn khác hoặc lineId không tồn tại. Tính lại `subtotal`/`discountAmount`/`tax`/`total` bằng `calcTotals` (đơn cũ thiếu `discount` thì dùng `discountAmount` fallback) và cập nhật `updatedAt`.
- Nếu đơn đang soạn (`editingPendingOrderId === orderId`), cùng thay đổi được mirror vào `cart` active để `savePendingOrder()`/`payPendingOrder()` không ghi đè. `pendingLineIndex` + `editedLineIds` giữ `lineId` gốc sau khi xoá dòng (tránh lệch chỉ số snapshot).
- **Giữ nguyên:** “Chọn tất cả”, cảnh báo thanh toán 2 bước, save-before-pay, 3 badge trạng thái Orders, bàn bận tới khi thu/huỷ, `lineId = ${order.id}:${index}` cho đơn không đang soạn.
- **Không đổi:** persist key/version `restodash-pos-v1` **v4** (không migration mới), server/schema/e2e, branding RestoDash, dependency, công thức tiền.

## Files changed

| File | Thay đổi |
| --- | --- |
| `src/store/usePOSStore.ts` (+ test) | Task 1: 2 action + helper vá/tính totals/mirror cart. Task 2: `pendingLineIndex`, cart ids cho `setAllPendingServed` |
| `src/components/order/OrderModal.tsx` (+ test) | Task 2: `CartRow` cho đơn chờ, callbacks 3 action, `viewTotals` mới, reset `receivedInput`, bỏ chú thích cố định, giữ lineId gốc |
| `src/components/order/CartRow.tsx` | Task 2: ưu tiên `line.name`/`line.unitPrice` từ snapshot (hiển thị đúng món chờ) |
| `src/pages/OrdersPage.test.tsx` | Task 2: cập nhật kỳ vọng tổng tính lại + guard tổng cũ đã biến mất |
| `PROJECT.md` | Block cập nhật đầu file, §0.2/§2.2/§4.8/§7.1 test counts, §0.4 bản đồ file, §2.4, §4.2 luồng, §4.5, §6 invariants, §8.4d, smoke 17, nhật ký, Phụ lục B |
| `README.md` | Bullet “Sửa món trong đơn chờ”, test count 346, link báo cáo |
| `docs/superpowers/reports/2026-11-22-edit-pending-items-report.md` | Báo cáo này |

Không có file production/server nào đổi ở Task 3.

## Verification

Tất cả lệnh chạy trên working tree sau Task 2 / trước commit tài liệu. Exit code 0 cho cả 6 lệnh.

| Lệnh | Kết quả |
| --- | --- |
| root `npm test` | **39 file / 346/346 pass** (baseline 331/331) |
| root `npm run lint` | exit 0; 5 warning `react(only-export-components)` có sẵn trong `src/app/router.tsx` |
| root `npm run build` | pass — `tsc -b` + Vite build; PWA 30 precache entries (1805.72 KiB); 1 warning `INEFFECTIVE_DYNAMIC_IMPORT` (`worker.ts`) có sẵn |
| server `npm test` | **11 file / 64/64 pass** |
| server `npm run lint` | exit 0, sạch (`oxlint --type-aware src/ test/`) |
| server `npm run test:e2e` | **13 file / 108/108 pass** (Postgres `restodash_test`, migrate deploy + seed tự động) |

### Số test trước / sau

| Suite | Trước thay đổi (`86d420a`) | Sau Task 1 (`470b2b4`) | Sau Task 2 (`d94e889`) | Sau Task 3 | Delta |
| --- | --- | --- | --- | --- | --- |
| Root (`npm test`) | 331 / 39 file | 343 / 39 file | 346 / 39 file | **346 / 39 file** | +15 (12 store + 3 modal) |
| Server unit | 64 / 11 file | 64 / 11 file | 64 / 11 file | 64 / 11 file | 0 |
| Server e2e | 108 / 13 file | 108 / 13 file | 108 / 13 file | 108 / 13 file | 0 |

Ghi chú baseline: tài liệu cũ ghi 329 test (thời điểm báo cáo UI popup); commit `9e9142b` (`fix(pos): keep served flags when saving an edited pending order`) thêm 2 test trước khi bắt đầu module này, nên baseline thực tế là **331**. `PROJECT.md` và `README.md` đã được cập nhật lên 346. Server xác nhận không đổi mã/schema/e2e.

## Concerns

- Ánh xạ `lineId` khi đang soạn đơn dựa vào vị trí của dòng thuộc đơn trong giỏ active. Đúng với resume/pending edits/“Thêm món”; chưa có test cho trường hợp xoá trực tiếp một dòng đã ra trong giỏ POS trong lúc đang soạn cùng đơn — khi đó ánh xạ có thể lệch (xem Task 2 report). Không có identifier mới trong `OrderLineSnapshot` nên không thể khắc phục trọn vẹn mà không đổi persist shape.
- Theo đúng spec, sửa một dòng sẽ reset ô tiền thu về tổng mới; số tiền tuỳ chỉnh đã gõ trước đó bị thay thế (thao tác Thanh toán thì không reset — các test giữ tiền thối cũ vẫn pass).
- `qty ≤ 0` → xoá, `qty ≥ 1` → cập nhật; giá trị thập phân ở giữa vẫn lưu (tính tiền floor qty), giá trị không hữu hạn bị bỏ qua. `updatedAt` dùng `Date.now()` như các action lân cận nên 2 sửa trong cùng mili-giây có thể bằng nhau.
- Tài liệu lịch sử (`specs/2026-11-22-order-popup-*.md`, plan/report popup trước) vẫn mô tả “số lượng chỉ đọc ở chế độ chờ”; cố ý giữ nguyên để không viết lại lịch sử. `PROJECT.md`/`README.md` là nguồn sự thật hiện hành.
- Chưa có E2E UI trong repo; nghiệm thu trực quan dựa trên component test + smoke 17 trong `PROJECT.md` §11.3. Root lint/build vẫn có warning có sẵn nêu ở bảng trên.

## Checklist đối chiếu spec

- Popup chờ dùng `CartRow`, stepper −/+ và xoá cho món chưa ra ✅
- Món `served === true` khoá giảm/xoá, vẫn toggle served ✅
- Tổng/tiền thu tính lại bằng `calcTotals`; reset `receivedInput` ✅
- Đồng bộ giỏ active khi `editingPendingOrderId === orderId` ✅
- “Thêm món” vẫn sẵn; cảnh báo 2 bước, badge trạng thái giữ nguyên ✅
- Persist `restodash-pos-v1` v4, server, branding không đổi ✅
- Full verification 6 lệnh xanh; tài liệu cập nhật ✅
