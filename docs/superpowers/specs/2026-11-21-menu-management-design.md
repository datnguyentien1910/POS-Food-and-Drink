# Thiết kế — Module quản lý menu (thêm/sửa/xoá món, đổi giá, đổi ảnh)

> **Ngày:** 2026-11-21
> **Trạng thái:** ĐÃ CHỐT hướng (chủ dự án trả lời Q1–Q6). Chờ duyệt để chuyển thành plan triển khai.
> **Phạm vi:** chỉ module quản lý menu (món ăn). Không đụng POS, đơn hàng, bàn.
> **Tài liệu liên quan:** `PROJECT.md`, `docs/superpowers/specs/2026-11-19-backend-foundation-spec.md`, `docs/superpowers/plans/2026-11-20-fe-be-connection-pos.md`.

---

## 1. Mục tiêu

Chủ quán / quản lý tự cập nhật thực đơn ngay trên app: **thêm món**, **sửa món** (tên, mô tả, giá, nhóm, ảnh, trạng thái), **xoá món**, và **đánh dấu tạm hết món**. Thu ngân (CASHIER) chỉ xem, không sửa.

## 2. Quyết định đã chốt

| ID | Quyết định |
| --- | --- |
| Q1 | **Upload ảnh thật**: server nhận file, lưu trên đĩa, phục vụ tĩnh. S3/MinIO để phase sau. |
| Q2 | Chỉ **OWNER + MANAGER** được tạo/sửa/xoá/đổi ảnh. CASHIER chỉ đọc. |
| Q3 | **Không quản lý nhóm món**: nhóm giữ nguyên như seed; món mới chỉ được gán vào nhóm có sẵn. |
| Q4 | Hết hàng → đặt `available=false`, UI hiện nhãn **"Tạm hết món"**; **Xoá** là hành động riêng khi không bán món đó nữa. |
| Q5 | **Không cần offline** cho màn quản lý (khác POS). |
| Q6 | Trường sửa được (tôi chốt): `name`, `description`, `price`, `categoryId`, `available`, `popular`, `sortOrder`, `image`. |

## 3. Hiện trạng (điểm chạm)

- Backend `server/src/menu/` **mới chỉ đọc**: `GET /menu`, `GET /menu/categories` (`menu.controller.ts`, `menu.service.ts`). Chưa có API ghi.
- `MenuItem` (`server/prisma/schema.prisma`): `name`, `description`, `price Int` (VND), `imageKey String?`, `available Boolean`, `popular Boolean`, `sortOrder Int`, `categoryId`, `restaurantId`. `OrderItem` lưu `name`/`unitPrice` snapshot và `menuItemId onDelete: SetNull` ⇒ đổi giá/xoá món **không** ảnh hưởng đơn cũ.
- Ảnh FE hiện là asset đóng gói: `imageKey → src/assets/menu/*.webp` (`src/lib/catalog-assets.ts`, `src/lib/catalog-map.ts`).
- Phân quyền: decorator `@Roles(...)` + `RolesGuard` toàn cục (`server/src/common/decorators/roles.decorator.ts`). Audit: `AuditService.record(...)` + enum `AuditAction`.
- Trang `menu` đã có trong `APP_PAGES` (`src/config.ts`) nhưng đang render `PlaceholderPage`; `src/App.tsx` là điểm nối trang.
- Chưa có hạ tầng upload/storage/`multer` trong `server/src`.

## 4. Thay đổi dữ liệu

1. `MenuItem.imageUrl String?` — URL ảnh upload (vd `/uploads/menu/<uuid>.webp`). Giữ `imageKey` cho ảnh thư viện cũ. FE ưu tiên `imageUrl`, fallback `imageKey`.
2. Thêm giá trị enum `AuditAction`: `MENU_ITEM_CREATED`, `MENU_ITEM_UPDATED`, `MENU_ITEM_DELETED`.

## 5. Hợp đồng API (prefix `/api/v1`, envelope `{ data }`)

### Đọc (giữ nguyên, bổ sung `imageUrl`)
- `GET /menu` → `categories[].items[]` thêm `imageUrl: string | null`.
- `GET /menu/categories` → `[{ id, name, sortOrder }]`.

### Ghi — `@Roles('OWNER','MANAGER')`
- `POST /menu/items` → **201** trả `MenuItemResponse`.
  Body: `{ categoryId: uuid, name: 1..120, description?: ≤500, price: int 0..10_000_000, available?: bool=true, popular?: bool=false, sortOrder?: int=0, imageKey?: ≤120|null }`.
- `PATCH /menu/items/:id` → **200** trả `MenuItemResponse` (mọi trường trên, tuỳ chọn).
- `DELETE /menu/items/:id` → **204** (xoá cứng; `OrderItem.menuItemId` tự về `null`).
- `POST /menu/items/:id/image` (`multipart/form-data`, field `file`) → **200** trả `MenuItemResponse` với `imageUrl` mới.

### Lỗi
| Tình huống | HTTP | code |
| --- | --- | --- |
| Thiếu quyền | 403 | `FORBIDDEN` (guard sẵn có) |
| Không tìm thấy món | 404 | `MENU_ITEM_NOT_FOUND` |
| `categoryId` không thuộc quán | 404 | `MENU_CATEGORY_NOT_FOUND` |
| Sai định dạng ảnh | 400 | `IMAGE_INVALID_TYPE` |
| Ảnh quá lớn (>2MB) | 400 | `IMAGE_TOO_LARGE` |

## 6. Ảnh upload

- Lưu tại `UPLOAD_DIR` (env mới, mặc định `<server>/uploads`) thư mục con `menu/`, tên `<randomUUID>.<ext>`.
- Chỉ nhận `image/jpeg`, `image/png`, `image/webp`; tối đa **2MB**.
- Phục vụ tĩnh: `NestExpressApplication.useStaticAssets(uploadDir, { prefix: '/uploads/' })`; URL trả về `/uploads/menu/<file>`.
- Dev: thêm proxy Vite `/uploads` → `http://localhost:3001` (giống `/api`).
- Thay ảnh/xoá món: xoá file upload cũ (bỏ qua lỗi nếu file không còn).

## 7. Giao diện (trang `menu`)

- `src/pages/MenuPage.tsx`: nạp `GET /menu` + `GET /menu/categories`; hiển thị món theo nhóm.
- Mỗi dòng: ảnh, tên, giá (định dạng VND), nhãn **"Tạm hết món"** khi `available=false`.
- Nút **Thêm món**, **Sửa**, **Xoá** chỉ hiện khi role ∈ {OWNER, MANAGER}; xoá qua `ConfirmModal`.
- `MenuItemFormModal`: nhập tên, giá, nhóm (select từ danh sách, bỏ `all`/`popular`), mô tả, `popular`, `available`, và **tải ảnh** (xem trước).
- Sau mỗi thao tác: gọi `useCatalogStore.getState().refresh()` để POS thấy thay đổi.
- Không lưu offline; lỗi mạng hiển thị qua toast, không xếp hàng đợi.

## 8. Ngoài phạm vi (non-goals)

- Quản lý nhóm món (Category CRUD).
- S3/MinIO, nén/resize ảnh phía server, CDN.
- Offline queue cho màn quản lý.
- Xoá mềm/lịch sử phiên bản món.
- Phân quyền chi tiết hơn OWNER/MANAGER/CASHIER.

## 9. Giả định & rủi ro

- Nhóm `all`/`popular` là ảo; form lọc bỏ, không tạo món vào đó.
- Xoá cứng làm mất liên kết lịch sử (`menuItemId` → null) nhưng đơn cũ giữ `name`/`unitPrice`, nên báo cáo không đổi. Chấp nhận theo Q4.
- Ảnh lưu trên đĩa server: mất khi đổi máy/host; chấp nhận ở phase này (đã ghi nợ S3).
- Deploy nhiều instance sẽ không chia sẻ ổ đĩa — ghi nợ, chưa cần bây giờ.
