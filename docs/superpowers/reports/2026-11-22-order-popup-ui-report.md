# Báo cáo hoàn tất — Chỉnh giao diện popup đơn POS (`xl`, 2 cột)

- **Ngày:** 2026-11-22
- **Nhánh:** `feat/order-popup` (tiếp nối module popup đơn dùng chung)
- **Base commit:** `b025af3` (Task 5 bắt đầu từ đây; UI change nằm ở các commit trước đó)
- **Spec:** `docs/superpowers/specs/2026-11-22-order-popup-ui-design.md`
- **Plan:** `docs/superpowers/plans/2026-11-22-order-popup-ui.md`
- **Trạng thái:** Sẵn sàng merge — **Yes** (không có concern chặn)

## Phạm vi đã giao

| Task | Commit | Nội dung |
| --- | --- | --- |
| 0 | `b94eab2` | Spec + plan chỉnh giao diện popup được duyệt |
| 1 | `b4a58ee` | `Modal` thêm size `xl` (`max-w-5xl`); test size mới |
| 2 | `5b60cf1` | Store: `setPendingOrderTable`, `setPendingLineServed`, `setAllPendingServed` — vá bản ghi chờ không resume |
| 3 | `0b04ac7`, `aad45d9` | `OrderModal` dùng `xl`, 2 cột; chọn bàn + served trong popup cả 2 chế độ; giữ bàn đã sửa khi đổi bàn đơn chờ |
| 4 | `b025af3` | `OrderPanel` bỏ chọn bàn/served; chỉ còn món + tổng + **Tạo đơn** |
| 5 | (task này) | Tài liệu + polish `CartRow` + full verification |

## Hành vi sau thay đổi

- Popup `OrderModal` dùng size `xl` (~1024px, `max-w-5xl`), desktop **2 cột**: trái chọn bàn/Mang đi + danh sách món, phải ghi chú/giảm giá/tổng/phương thức thanh toán/nút; mobile co về 1 cột. `Modal` chỉ thêm một size, `sm`/`md`/`lg` giữ nguyên.
- Panel phải giờ **chỉ quản lý món + tổng tiền + nút Tạo đơn** (kèm lưu tạm/xoá đơn): không còn `TableBadge`, "Mang ra"/"Đã ra" trên từng dòng, "Chọn tất cả".
- Chọn bàn/Mang đi và tick served ("Mang ra"/"Đã ra", "Chọn tất cả") nằm **trong popup cho cả chế độ tạo mới và đơn chờ**. Ở chế độ chờ, số lượng chỉ đọc (dùng "Thêm món" để sửa ở POS); badge/toggle served vẫn gated bởi `showServed`.
- **Đổi bàn trong đơn chờ** (`setPendingOrderTable`) vá ngay `tableId`/`tableName` trên bản ghi `pending_payment` đó (giữ `clientId`, món, tổng, ghi chú; không tạo bản mới, không resume): bàn cũ hết bận, bàn mới bận. Các action `setPendingLineServed`/`setAllPendingServed` vá cờ `served` trên đúng đơn, không đụng giỏ active hay `editingPendingOrderId`.
- Dòng đã mang ra vẫn khoá sửa/xoá; stepper bị vô hiệu hoá bằng `<fieldset disabled>` ở **mọi nơi**, kể cả panel không hiển thị nút served (Task 5 polish). Cảnh báo thanh toán 2 bước, 3 badge trạng thái Orders, luật món đã ra giữ nguyên.
- **Persist vẫn `restodash-pos-v1` v4** — không migration mới, không đổi key/version. **Server/schema/e2e không đổi.** Không đổi brand RestoDash → Serva (task riêng cuối dự án).

## Files changed

| File | Thay đổi |
| --- | --- |
| `docs/superpowers/specs/2026-11-22-order-popup-ui-design.md` | Spec thiết kế (Task 0) |
| `docs/superpowers/plans/2026-11-22-order-popup-ui.md` | Plan 5 task (Task 0) |
| `src/components/ui/Modal.tsx` (+ test) | `ModalSize` thêm `'xl'`, `sizes.xl = 'max-w-5xl'` |
| `src/store/usePOSStore.ts` (+ test) | 3 action vá đơn chờ: đổi bàn, tick 1 món, tick tất cả |
| `src/components/order/OrderModal.tsx` (+ test) | Popup `xl` 2 cột; chọn bàn/served trong cả 2 chế độ; giữ bàn đã sửa khi đổi bàn; save-before-pay và cảnh báo 2 bước nguyên vẹn |
| `src/components/order/OrderPanel.tsx` (+ test) | Bỏ `TableBadge`, "Chọn tất cả", `showServed`/`onToggleServed` |
| `src/components/order/CartRow.tsx` | **Task 5 polish:** stepper luôn nằm trong `<fieldset disabled={served}>`, kể cả khi `showServed === false`; badge/toggle vẫn gated bởi `showServed` |
| `src/components/order/OrderPanel.test.tsx` | **Task 5:** test mới — stepper của dòng đã ra bị disable dù panel không có điều khiển served |
| `PROJECT.md` | Block cập nhật UI popup; test counts; panel/popup map; data flow; invariant rows; §8.4c; QA smoke 16; nhật ký + liên kết báo cáo |
| `README.md` | Mô tả popup `xl` 2 cột, panel chỉ món, chọn bàn/served trong popup, đổi bàn đơn chờ; số test 329; link báo cáo |
| `docs/superpowers/reports/2026-11-22-order-popup-ui-report.md` | Báo cáo mới (file này) |

Task 5 không đổi production behavior ngoài polish `CartRow` (khoá stepper đúng trạng thái đã ra); không đụng server, không đổi brand.

## Verification

Tất cả lệnh chạy trên working tree sau khi hoàn tất Task 5. Exit code 0 cho cả 6 lệnh.

| Lệnh | Kết quả |
| --- | --- |
| root `npm test` | **39 file / 329/329 pass** (trước polish Task 5: 328/328) |
| root `npm run lint` | exit 0; 5 warning `react(only-export-components)` có sẵn trong `src/app/router.tsx` (không phải lỗi mới) |
| root `npm run build` | pass — `tsc -b` + Vite build; PWA 30 precache entries (1804.96 KiB); 1 warning `INEFFECTIVE_DYNAMIC_IMPORT` (`worker.ts`) có sẵn từ trước |
| server `npm test` | **11 file / 64/64 pass** |
| server `npm run lint` | exit 0, sạch (`oxlint --type-aware src/ test/`) |
| server `npm run test:e2e` | **13 file / 108/108 pass** (Postgres `restodash_test`, migration + seed tự động) |

### Số test trước / sau

| Suite | Trước chỉnh UI (base popup `e4f083d`) | Sau Tasks 1–4 (`b025af3`) | Sau Task 5 | Delta |
| --- | --- | --- | --- | --- |
| Root (`npm test`) | 318 test / 39 file | 328 test / 39 file | **329 test / 39 file** | +11 (trong đó +1 test polish Task 5) |
| Server unit | 64 / 11 file | 64 / 11 file | 64 / 11 file | 0 |
| Server e2e | 108 / 13 file | 108 / 13 file | 108 / 13 file | 0 |

Test mới nằm trong `Modal.test.tsx`, `usePOSStore.test.ts`, `OrderModal.test.tsx`, `OrderPanel.test.tsx`; số file test giữ nguyên 39. Server xác nhận không đổi mã/schema/e2e.

## Concerns

- Root lint vẫn có 5 warning `fast-refresh` trong `router.tsx` (có sẵn từ module popup trước, không chặn build/test); build vẫn có 1 warning `INEFFECTIVE_DYNAMIC_IMPORT` cho `worker.ts` (có sẵn).
- Chưa có E2E UI trong repo; nghiệm thu trực quan 2 cột/mobile dựa trên test component + QA tay theo §11.2/§11.3 của `PROJECT.md` (mục smoke 16). Server e2e phụ thuộc Postgres + `TEST_DATABASE_URL`, đã chạy đầy đủ trong môi trường này.
- Tài liệu lịch sử (`specs/2026-11-22-order-popup-design.md`, plan/report module popup trước) vẫn mô tả trạng thái trước lần chỉnh UI; cố ý giữ nguyên để không viết lại lịch sử. `PROJECT.md`/`README.md` là nguồn sự thật hiện hành.
- Không đổi brand RestoDash → Serva theo yêu cầu; đây vẫn là task riêng cuối dự án.

## Checklist đối chiếu spec

- Popup `xl` ~1024px, 2 cột desktop, 1 cột mobile ✅
- Panel phải không còn "Chọn bàn"/"Mang ra"/"Đã ra"/"Chọn tất cả" ✅
- Chọn bàn + served dùng được ở cả chế độ tạo và đơn chờ ✅
- Đổi bàn đơn chờ cập nhật đúng bản ghi, bàn cũ hết bận, không tạo đơn mới ✅
- Stepper dòng đã ra bị khoá ở mọi nơi (kể cả panel) ✅
- Persist v4/key `restodash-pos-v1` giữ nguyên; server không đổi ✅
- Root + server test/lint/build/e2e xanh ✅
