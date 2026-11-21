# Báo cáo — Quản lý menu (thêm/sửa/xoá món, đổi giá, đổi ảnh)

> **Spec:** `docs/superpowers/specs/2026-11-21-menu-management-design.md` (thẩm quyền)
> **Plan:** `docs/superpowers/plans/2026-11-21-menu-management-plan.md`
> **Nhánh:** `feat/menu-management` (điểm xuất phát `acc126b`)
> **Ngày:** 21/11/2026
> **Trạng thái:** Hoàn thành B1–B3, F1–F4. Review nhánh xong, 3 lỗi Important đã sửa. Tất cả cổng kiểm tra xanh.

---

## 1. Tóm tắt điều hành

Chủ quán / quản lý tự cập nhật thực đơn ngay trên app: **thêm món, sửa món, xoá món, đổi giá, đổi ảnh, đánh dấu tạm hết món**. Thu ngân (CASHIER) chỉ xem.

- **Backend:** `POST/PATCH/DELETE /menu/items`, `POST /menu/items/:id/image` (upload thật, lưu đĩa, phục vụ tĩnh), tất cả `@Roles('OWNER','MANAGER')`, kiểm tra chéo nhà hàng, ghi audit `MENU_ITEM_CREATED/UPDATED/DELETED`.
- **Frontend:** trang `menu` với danh sách theo nhóm, giá VND, nhãn "Tạm hết món", nút Sửa/Xoá theo vai trò, modal thêm/sửa có upload ảnh (xem trước), xoá qua `ConfirmModal`, làm mới `useCatalogStore` để POS thấy thay đổi.

Kết quả cổng kiểm tra sau sửa (đã chạy thật, xem §5):

| Bộ kiểm tra | Kết quả |
| --- | --- |
| Root `npm run lint` | ✅ sạch |
| Root `npm test` | ✅ **169/169** (31 file) |
| Root `npm run build` | ✅ pass |
| Server `npm run lint` | ✅ sạch |
| Server `npm run test:e2e` | ✅ **91/91** (13 file) |
| Server `npm run build` | ✅ pass |

---

## 2. Sản phẩm bàn giao theo task

### B1 — `MenuItem.imageUrl` + audit enum + migration — commit `047fcbc`

- Thêm `imageUrl String?` vào `MenuItem`; giữ `imageKey` cho ảnh thư viện cũ.
- Thêm giá trị enum `AuditAction`: `MENU_ITEM_CREATED`, `MENU_ITEM_UPDATED`, `MENU_ITEM_DELETED`.
- Migration `20261121014702_menu_item_image_and_audit`.

### B2 — Tạo/sửa/xoá món + audit — commit `1485a9f`

- `MenuService.createItem/updateItem/deleteItem`; `MenuController` route `POST/PATCH/DELETE`.
- `@Roles('OWNER','MANAGER')`; kiểm tra `categoryId`/`id` thuộc đúng `restaurantId` (`assertCategory`, `findItemOrThrow`).
- Audit `before`/`after` cho từng hành động.
- e2e: giá âm/quá lớn → 400, giá 0 hợp lệ, category lạ / category nhà hàng khác → 404 `MENU_CATEGORY_NOT_FOUND`, CASHIER → 403, ẩn danh → 401.

### B3 — Upload ảnh + phục vụ tĩnh — commit `53b605b`

- Multer disk storage, chỉ nhận JPEG/PNG/WebP, tối đa 2MB; lỗi `IMAGE_INVALID_TYPE` / `IMAGE_TOO_LARGE` đúng envelope.
- `UPLOAD_DIR` (mặc định `<cwd>/uploads`), con `menu/`, tên `<randomUUID>.<ext>`.
- `NestExpressApplication.useStaticAssets(uploadDir, { prefix: '/uploads/' })`.
- Dọn file cũ khi thay ảnh; guard chạy trước interceptor nên CASHIER không ghi được file.

### F1 — API client + FormData + proxy — commit `73c049b`

- `src/api/menu.ts`: `createMenuItem`, `updateMenuItem`, `deleteMenuItem`, `uploadMenuItemImage`.
- `src/api/http.ts`: hỗ trợ body `FormData` (không tự set `Content-Type`); `ServerMenuItem.imageUrl`.
- Vite proxy `/uploads` → `http://localhost:3001`.

### F2 — Trang quản lý menu — commit `d5cc2c0`

- `src/pages/MenuPage.tsx`: nạp `GET /menu` + `GET /menu/categories`, nhóm theo `sortOrder`, giá VND, nhãn "Tạm hết món", nút Sửa/Xoá chỉ với OWNER/MANAGER.
- `resolveMenuImage(imageUrl, imageKey)` ưu tiên ảnh upload, fallback asset cũ.

### F3 — Modal thêm/sửa + upload ảnh — commit `cc07dbe`

- `MenuItemFormModal` + `MenuImageField`: tên, giá (chặn số không nguyên/âm), nhóm (lọc `all`/`popular`), mô tả, `popular`, `available`, tải ảnh xem trước.
- Upload ảnh sau khi tạo/sửa (không tạo trùng khi upload lỗi); thu hồi object URL.
- Ruling F3 trong ledger: test mock `../../api/menu`; `ServerMenuItem` không có `categoryId` nên `MenuPage` truyền kèm id nhóm khi mở form sửa.

### F4 — Xoá + làm mới catalog + route — commit `30040d9`

- Xoá qua `ConfirmModal`; gọi `useCatalogStore.getState().refresh()` rồi nạp lại danh sách.
- `src/App.tsx`: route `menu` → `MenuPage`.
- Ruling F4: build phát hiện lỗi TS ở FormData (F1), sửa bằng biến cục bộ `BodyInit | undefined`.

---

## 3. Review nhánh & xử lý

Review toàn nhánh `acc126b..30040d9` (8 commit) bằng subagent ngữ cảnh mới, gói diff tại `.superpowers/sdd/2026-11-21-menu-management-plan/review-acc126b..30040d9.diff`.

**Kết quả: 0 Critical, 3 Important, 6 Minor.** Re-grade theo tác động thực tế (spec là văn bản tầm nhìn): giữ nguyên 3 Important.

### 3.1. Đã sửa (Important) — commit `a073886`

| # | Lỗi | Sửa | Bằng chứng |
| --- | --- | --- | --- |
| 1 | Tạo/sửa món **không** làm mới catalog POS (chỉ xoá mới làm) — vi phạm spec §7; POS vẫn thấy giá/món cũ đến khi reload | `MenuPage` thêm `handleSaved` gọi cả `fetchMenu()` và `useCatalogStore.getState().refresh()` | `MenuPage.test.tsx` › "refreshes the POS catalog after saving a new item" ĐỎ→XANH |
| 2 | Xoá món **không** xoá file ảnh đã upload — vi phạm spec §6; rò rỉ file mỗi lần xoá | `MenuService.deleteItem` gọi `removeUploadedFile(existing.imageUrl)` | `menu-items.e2e-spec.ts` › "deletes an item, removes its image file, and records MENU_ITEM_DELETED audit" ĐỎ→XANH |
| 3 | Upload vào `id` không tồn tại / của nhà hàng khác: file đã ghi xuống đĩa trước khi service báo 404 → file mồ côi tích luỹ | `setItemImage` bọc `findItemOrThrow`, xoá file vừa ghi khi không tìm thấy | `menu-items.e2e-spec.ts` › "writes no orphan file when uploading to an unknown item" ĐỎ→XANH |

Bổ sung: trích helper chung `removeUploadedFile(imageUrl)` dùng cho cả 3 đường (thay ảnh, xoá món, upload lỗi).

### 3.2. Minor (hoãn — ghi nợ)

1. Chưa thêm `UPLOAD_DIR` vào `server/.env.example`; chưa ignore `uploads/`, `.tmp/` trong git.
2. Upload thiếu file trả `VALIDATION_ERROR` chung thay vì mã `IMAGE_*`.
3. Mô tả rỗng lưu `''` thay vì `null`.
4. e2e chưa kiểm tra audit `MENU_ITEM_CREATED/UPDATED` + `before`/`after`, category nhà hàng khác khi **cập nhật**, CASHIER trên route **upload**.
5. Audit ghi tách rời với mutation (không transaction).
6. `MenuItemResponse` thiếu `categoryId` nên form sửa phải chèn `categoryId` phía client.

### 3.3. Ruling cho danh sách "declined to judge"

- `sortOrder` không có trong form UI — spec §7 không liệt kê; API vẫn hỗ trợ.
- `imageKey` không sửa được trong form — giữ vai trò khóa asset cũ, không thuộc §7.
- Không dò nội dung ảnh ngoài whitelist MIME — spec §6 chỉ yêu cầu whitelist.
- `/uploads` phục vụ không auth — spec §6 chỉ nói "phục vụ tĩnh"; URL là UUID khó đoán.
- Category CRUD / soft delete / S3 / CDN / offline queue — ngoài phạm vi §8.
- Ổ đĩa dùng chung nhiều instance — nợ đã ghi ở §9.
- `formatCurrency` (plan) vs `formatVND` (thực tế) — chỉ khác tên.
- Đường dẫn mock `vi.mock('../api/menu')` của plan F3 — đã ruling và sửa.
- Modal giữ state cũ nếu chọn món khác khi đang mở — không với tới được (overlay chặn).
- Vitest chạy song song trên `restodash_test` — thiết kế hạ tầng test có sẵn, không thuộc tính năng này.

---

## 4. Lịch sử commit trong đợt

| Commit | Nội dung |
| --- | --- |
| `ac985be` | docs: spec + plan quản lý menu |
| `047fcbc` | feat(server): B1 — `imageUrl` + audit enum + migration |
| `1485a9f` | feat(server): B2 — tạo/sửa/xoá món + audit |
| `53b605b` | feat(server): B3 — upload ảnh + phục vụ tĩnh |
| `73c049b` | feat(web): F1 — API client menu + proxy ảnh |
| `d5cc2c0` | feat(web): F2 — trang quản lý menu |
| `cc07dbe` | feat(web): F3 — modal thêm/sửa món + upload ảnh |
| `30040d9` | feat(web): F4 — xoá món + route |
| `a073886` | fix(menu): làm mới catalog POS khi lưu + dọn file ảnh món |

---

## 5. Bằng chứng cổng kiểm tra (chạy thật trên máy này)

```text
# Root
$ npm run lint      → oxlint  (không lỗi)
$ npm test          → Test Files 31 passed (31) · Tests 169 passed (169)
$ npm run build     → tsc + vite build  (thành công)

# Server
$ npm run lint      → oxlint --type-aware src/ test/  (không lỗi)
$ npm run test:e2e  → Test Files 13 passed (13) · Tests 91 passed (91)
$ npm run build     → nest build  (thành công)
```

Ghi chú môi trường: trước khi test lại trong thư mục dự án cần `npm run prisma:generate` và `npm ci` cho `server/` (client Prisma + `@types/multer` chưa cập nhật sau khi thêm schema/dependency).

---

## 6. Kết luận

Plan được thực thi trọn vẹn B1–B3, F1–F4 đúng TDD (mỗi test đỏ trước khi code). Review nhánh tìm 0 Critical, 3 Important — tất cả đã sửa kèm test đỏ→xanh và chạy lại toàn bộ suite. 6 điểm Minor ghi nợ theo quyết định, không chặn merge. Sẵn sàng hoàn tất nhánh.
