# Menu Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho OWNER/MANAGER thêm/sửa/xoá món, đổi giá và tải ảnh lên, ngay trong trang "Thực đơn"; CASHIER chỉ xem.

**Architecture:** Mở rộng module `server/src/menu/` bằng các endpoint ghi (create/update/delete + upload ảnh) có `@Roles('OWNER','MANAGER')` và ghi audit; ảnh lưu trên đĩa, phục vụ tĩnh qua `/uploads`. Thêm trang `MenuPage` ở FE gọi các API đó, tái dùng `useCatalogStore.refresh()` để POS thấy thay đổi. Online-only.

**Tech Stack:** NestJS 12 (ESM, `.js` relative imports), Prisma 7 + Postgres, class-validator, `FileInterceptor` (multer qua `@nestjs/platform-express`), Vitest + supertest (BE); React + Vite + TypeScript, Zustand, Vitest + Testing Library (FE).

**Spec:** `docs/superpowers/specs/2026-11-21-menu-management-design.md` (file thiết kế đi kèm plan này; đọc cả hai).

## Global Constraints

- Money là **số nguyên VND**. Không dùng số thực cho giá.
- Envelope thành công: `{ data, meta? }`; lỗi: `{ error: { code, message, details? } }` (đã có `TransformInterceptor`/`AllExceptionsFilter`).
- Prefix API `/api/v1`; Swagger `/api/docs`.
- Phân quyền qua decorator `@Roles(...)` + `RolesGuard` (đã đăng ký toàn cục). Dùng đúng `'OWNER' | 'MANAGER' | 'CASHIER'`.
- Relative import phía server kết thúc bằng `.js`; test server dùng `vi.fn()` (không phải `jest.fn()`).
- `ValidationPipe` bật `whitelist` + `forbidNonWhitelisted` → mọi field trong body phải khai báo trong DTO.
- Chỉ nhận ảnh `image/jpeg`, `image/png`, `image/webp`; tối đa **2 MB**.
- Giữ `imageKey` cũ; ảnh mới dùng cột `imageUrl`. FE ưu tiên `imageUrl`, fallback `imageKey`, cuối cùng placeholder.
- Không thêm dependency runtime mới ngoài `multer` (đã có sẵn trong `@nestjs/platform-express`); chỉ thêm dev dep `@types/multer`.
- Seed accounts cho test: `owner@restodash.local/Owner@12345`, `manager@restodash.local/Manager@12345`, `cashier@restodash.local/Cashier@12345`.
- Giá trị seed tham chiếu: món `legacyId='ga-nuong'` giá `109000`; `GET /menu` trả **6** category, **16** món.

## Review Focus

Các tình huống spec ngụ ý nhưng test thường bỏ sót — mỗi dòng có test ở task tương ứng:

- Tạo/sửa món với `categoryId` của **quán khác** hoặc không tồn tại → phải 404, không tạo bản ghi mồ côi. (Task B2)
- Ảnh sai định dạng hoặc > 2 MB → 400 và **không** ghi file rác vào `uploads/`. (Task B3)
- CASHIER gọi endpoint ghi → 403, **không** đổi dữ liệu. (Task B2)
- Xoá món đã từng nằm trong đơn cũ → đơn cũ vẫn giữ `name`/`unitPrice`, chỉ `menuItemId` về `null`. (Task B2)
- Giá `0` hoặc âm, và giá cực lớn ngoài biên → chặn ở DTO (0 hợp lệ, âm và > 10_000_000 bị từ chối). (Task B2)

---

## Task B1: Schema + migration (`imageUrl`, giá trị audit mới)

**Files:**
- Modify: `server/prisma/schema.prisma` (`model MenuItem`, `enum AuditAction`)
- Create: `server/prisma/migrations/<timestamp>_menu_item_image_and_audit/migration.sql` (do `prisma migrate dev` sinh)
- Modify: `server/src/menu/menu.service.ts` (`MenuItemResponse` thêm `imageUrl`)
- Test: `server/test/menu.e2e-spec.ts` (thêm 1 case)

**Interfaces:**
- Produces: `MenuItem.imageUrl String?`; `MenuItemResponse.imageUrl: string | null`; enum `AuditAction` có thêm `MENU_ITEM_CREATED`, `MENU_ITEM_UPDATED`, `MENU_ITEM_DELETED`.

- [ ] **Step 1: Viết test đỏ** — trong `server/test/menu.e2e-spec.ts`, thêm case vào `describe('Menu (e2e)')`:

```ts
it('includes a nullable imageUrl on every item', async () => {
  const agent = await login();
  const response = await agent.get('/api/v1/menu').expect(200);
  const items = (response.body.data.categories as Array<{ items: Array<Record<string, unknown>> }>)
    .flatMap((c) => c.items);
  for (const item of items) expect(item).toHaveProperty('imageUrl', null);
});
```

- [ ] **Step 2: Chạy để xác nhận đỏ** — `npx vitest run --config ./vitest.config.e2e.ts test/menu.e2e-spec.ts` (Expected: FAIL — thiếu `imageUrl`).

- [ ] **Step 3: Sửa schema** — thêm vào `model MenuItem`: `imageUrl String?` (đặt cạnh `imageKey`). Thêm 3 giá trị vào `enum AuditAction`.

- [ ] **Step 4: Sinh migration** — trong `server/`: `npx prisma migrate dev --name menu_item_image_and_audit` (chạy `prisma generate` kèm theo). Kiểm tra `migration.sql` có `ALTER TABLE "MenuItem" ADD COLUMN "imageUrl" TEXT;` và `ALTER TYPE "AuditAction" ADD VALUE 'MENU_ITEM_CREATED';` (tương tự cho 2 giá trị còn lại).

- [ ] **Step 5: Cập nhật response** — trong `menu.service.ts`, thêm `imageUrl: item.imageUrl` vào `MenuItemResponse` và vào nhánh `.map` của `getMenu`.

- [ ] **Step 6: Chạy test xanh** — lặp lại lệnh Step 2 (Expected: PASS). Chạy cả suite: `npm run test:e2e` (Expected: 76/76 trở lên).

- [ ] **Step 7: Commit**

```bash
git add server/prisma server/src/menu/menu.service.ts server/test/menu.e2e-spec.ts
git commit -m "feat(server): add MenuItem.imageUrl and menu audit actions"
```

---

## Task B2: Endpoint ghi món (create / update / delete) + audit

**Files:**
- Create: `server/src/menu/dto/create-menu-item.dto.ts`
- Create: `server/src/menu/dto/update-menu-item.dto.ts`
- Modify: `server/src/menu/menu.service.ts`
- Modify: `server/src/menu/menu.controller.ts`
- Modify: `server/src/menu/menu.module.ts` (thêm `AuditController`? không — chỉ đảm bảo `MenuService` inject được `AuditService`; `AuditModule` đã `@Global`, không cần import)
- Test: `server/test/menu-items.e2e-spec.ts`

**Interfaces:**
- Consumes: `MenuItemResponse` (Task B1); `AuditService.record(input, tx?)`; `AuthenticatedUser { id, restaurantId, ... }`.
- Produces:
  - `CreateMenuItemDto { categoryId: string; name: string; description?: string; price: number; available?: boolean; popular?: boolean; sortOrder?: number; imageKey?: string | null }`
  - `UpdateMenuItemDto = PartialType(CreateMenuItemDto)`
  - `MenuService.createItem(restaurantId: string, dto: CreateMenuItemDto, actor: AuthenticatedUser, ctx: { ip?: string; userAgent?: string }): Promise<MenuItemResponse>`
  - `MenuService.updateItem(restaurantId: string, id: string, dto: UpdateMenuItemDto, actor: AuthenticatedUser, ctx): Promise<MenuItemResponse>`
  - `MenuService.deleteItem(restaurantId: string, id: string, actor: AuthenticatedUser, ctx): Promise<void>`
  - Controller routes dưới `@Controller('menu')`: `POST items`, `PATCH items/:id`, `DELETE items/:id` (dùng `ParseUUIDPipe`).

- [ ] **Step 1: Viết test đỏ** — tạo `server/test/menu-items.e2e-spec.ts` (mẫu setup sao chép từ `server/test/menu.e2e-spec.ts`: `createTestApp()`, `login(email,password)` trả `request.agent`). Định nghĩa `const OWNER`, `const MANAGER`, `const CASHIER`. Các case:

```ts
it('OWNER creates an item, and it appears in GET /menu', async () => { /* POST 201; GET /menu chứa id vừa tạo với price đúng */ });
it('rejects price < 0 and price > 10_000_000 with 400', async () => { /* hai POST, expect 400 */ });
it('accepts price = 0', async () => { /* 201 */ });
it('returns 404 MENU_CATEGORY_NOT_FOUND for a foreign/unknown categoryId', async () => { /* random uuid → 404, error.code === 'MENU_CATEGORY_NOT_FOUND' */ });
it('returns 404 MENU_ITEM_NOT_FOUND when updating an unknown id', async () => { /* PATCH random uuid → 404 */ });
it('MANAGER updates price and GET /menu reflects it', async () => { /* PATCH 200; price mới xuất hiện */ });
it('CASHIER cannot create, update or delete', async () => { /* cả 3 → 403, và giá trị dữ liệu không đổi */ });
it('rejects anonymous access', async () => { /* POST không cookie → 401 */ });
it('deletes an item and records MENU_ITEM_DELETED audit', async () => { /* DELETE 204; GET /menu không còn; GET /api/v1/audit?action=MENU_ITEM_DELETED có 1 dòng */ });
```

- [ ] **Step 2: Chạy để xác nhận đỏ** — `npx vitest run --config ./vitest.config.e2e.ts test/menu-items.e2e-spec.ts` (Expected: FAIL — 404 route chưa có).

- [ ] **Step 3: Viết DTO** — `create-menu-item.dto.ts` dùng `@IsUUID() categoryId`, `@IsString() @Length(1,120) name`, `@IsOptional() @IsString() @MaxLength(500) description`, `@IsInt() @Min(0) @Max(10_000_000) price`, `@IsOptional() @IsBoolean()` cho `available`/`popular`, `@IsOptional() @IsInt() @Min(0) sortOrder`, `@IsOptional() @IsString() @MaxLength(120) imageKey`. `update-menu-item.dto.ts`: `export class UpdateMenuItemDto extends PartialType(CreateMenuItemDto) {}` (import `PartialType` từ `@nestjs/swagger`).

- [ ] **Step 4: Viết service** — trong `menu.service.ts` (inject `AuditService` vào constructor):
  - `assertCategory(restaurantId, categoryId)`: `prisma.category.findFirst({ where: { id: categoryId, restaurantId } })`; nếu null ném `AppException(404, 'MENU_CATEGORY_NOT_FOUND', ...)`.
  - `createItem`: assert category → `prisma.menuItem.create({ data: { restaurantId, categoryId, name, description ?? null, price, imageKey ?? null, available: dto.available ?? true, popular: dto.popular ?? false, sortOrder: dto.sortOrder ?? 0 } })` → `audit.record({ restaurantId, actorId: actor.id, action: 'MENU_ITEM_CREATED', entity: 'MenuItem', entityId: item.id, after: <item>, ...ctx })` → trả `toResponse(item)`.
  - `updateItem`: `findFirst({ where: { id, restaurantId } })` → nếu null ném `AppException(404, 'MENU_ITEM_NOT_FOUND', ...)`; nếu `dto.categoryId` có thì assert category; `prisma.menuItem.update` với `before`/`after` trong audit (`MENU_ITEM_UPDATED`); trả `toResponse`.
  - `deleteItem`: `findFirst` → 404 nếu null; `prisma.menuItem.delete({ where: { id } })`; audit `MENU_ITEM_DELETED` với `before`.
  - Tách hàm `toResponse(item): MenuItemResponse` dùng chung cho `getMenu` và các hàm trên.

- [ ] **Step 5: Viết controller** — thêm vào `MenuController` (giữ `@ApiTags('menu')` + `@ApiCookieAuth(SESSION_COOKIE)`):

```ts
@Post('items') @HttpCode(201) @Roles('OWNER', 'MANAGER') @ApiOperation({ summary: 'Thêm món' })
createItem(@Body() dto: CreateMenuItemDto, @CurrentUser() user: AuthenticatedUser, @Req() request: Request) { ... }

@Patch('items/:id') @Roles('OWNER', 'MANAGER') ...
updateItem(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMenuItemDto, @CurrentUser() user, @Req() request) { ... }

@Delete('items/:id') @HttpCode(204) @Roles('OWNER', 'MANAGER') ...
deleteItem(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user, @Req() request) { ... }
```

Truyền `{ ip: clientIp(request), userAgent: userAgent(request) }` (import từ `../common/http/request.util.js`).

- [ ] **Step 6: Chạy test xanh** — lặp lại lệnh Step 2 (Expected: PASS), rồi `npm run lint` (sạch).

- [ ] **Step 7: Commit**

```bash
git add server/src/menu server/test/menu-items.e2e-spec.ts
git commit -m "feat(server): menu item create/update/delete with audit"
```

---

## Task B3: Upload ảnh + phục vụ tĩnh

**Files:**
- Create: `server/src/menu/menu-upload.ts`
- Modify: `server/src/config/env.ts` (thêm `UPLOAD_DIR`)
- Modify: `server/src/main.ts` (`NestExpressApplication`)
- Modify: `server/src/app.setup.ts` (`useStaticAssets`)
- Modify: `server/src/menu/menu.controller.ts`, `server/src/menu/menu.service.ts` (`setItemImage`)
- Modify: `server/package.json` (dev dep `@types/multer`)
- Test: `server/test/menu-items.e2e-spec.ts` (thêm case upload)

**Interfaces:**
- Consumes: `MenuItemResponse`; `AppException`.
- Produces:
  - `UPLOAD_DIR` trong env (default `path.join(process.cwd(), 'uploads')`).
  - `menuUploadOptions` (multer options: diskStorage vào `<UPLOAD_DIR>/menu`, tên `<randomUUID()><ext>`, `limits.fileSize = 2*1024*1024`, `fileFilter` chỉ `image/jpeg|png|webp`).
  - `MenuService.setItemImage(restaurantId, id, imageUrl, actor, ctx): Promise<MenuItemResponse>`.
  - Route `POST /api/v1/menu/items/:id/image` (`FileInterceptor('file', menuUploadOptions)`), `@Roles('OWNER','MANAGER')`.

- [ ] **Step 1: Cài dev dep** — `cd server && npm i -D @types/multer`.

- [ ] **Step 2: Viết test đỏ** — thêm vào `menu-items.e2e-spec.ts`:

```ts
it('uploads a webp image and exposes imageUrl', async () => { /* POST /menu/items/:id/image .attach('file', Buffer.from([...]), 'a.webp') → 200; body.data.imageUrl bắt đầu '/uploads/menu/'; GET /menu item tương ứng có cùng imageUrl; file tồn tại trên đĩa */ });
it('rejects a non-image upload with 400 IMAGE_INVALID_TYPE', async () => { /* attach text/plain → 400 */ });
it('rejects an image larger than 2MB with 400', async () => { /* Buffer.alloc(2*1024*1024 + 1) → 400 */ });
```

- [ ] **Step 3: Chạy để xác nhận đỏ** — `npx vitest run --config ./vitest.config.e2e.ts test/menu-items.e2e-spec.ts` (Expected: FAIL).

- [ ] **Step 4: Thêm env** — `envSchema` thêm `UPLOAD_DIR: z.string().optional()`; trong `configureApp`/service đọc qua `ConfigService` với default `path.join(process.cwd(), 'uploads')`.

- [ ] **Step 5: Viết `menu-upload.ts`** — export `menuUploadOptions`. Lưu ý `forbidNonWhitelisted`: endpoint multipart chỉ nhận field `file`, không có DTO body.

- [ ] **Step 6: Service `setItemImage`** — tìm món theo `restaurantId` (404 nếu không); nếu món có `imageUrl` cũ **và** file dưới `uploads/menu/` thì `fs.unlink` (bọc try/catch); `prisma.menuItem.update({ data: { imageUrl } })`; audit `MENU_ITEM_UPDATED` (ghi `before`/`after`).

- [ ] **Step 7: Phục vụ tĩnh** — `main.ts`: `NestFactory.create<NestExpressApplication>(AppModule)`; `app.setup.ts`: nhận `app` rồi `app.useStaticAssets(uploadDir, { prefix: '/uploads/' })`. Đảm bảo thư mục được tạo (`fs.mkdirSync(dir, { recursive: true })`).

- [ ] **Step 8: Chạy test xanh + cổng** — `npm run test:e2e` (PASS), `npm run lint`, `npm run build` (đều sạch).

- [ ] **Step 9: Commit**

```bash
git add server/package.json server/package-lock.json server/src server/test
git commit -m "feat(server): menu image upload and static serving"
```

---

## Task F1: API client FE + kiểu dữ liệu + hỗ trợ FormData + proxy ảnh

**Files:**
- Modify: `src/api/types.ts` (`ServerMenuItem` thêm `imageUrl: string | null`; thêm `ServerMenuCategorySummary`)
- Modify: `src/api/menu.ts`
- Modify: `src/api/http.ts` (cho phép `body` là `FormData`)
- Modify: `vite.config.ts` (proxy `/uploads` → `http://localhost:3001`)
- Test: `src/api/menu.test.ts` (mới)

**Interfaces:**
- Consumes: `request<T>`; `ApiError`.
- Produces:
  - `ServerMenuCategorySummary { id: string; name: string; sortOrder: number }`
  - `MenuItemInput { categoryId: string; name: string; description?: string; price: number; available?: boolean; popular?: boolean; sortOrder?: number }`
  - `getCategories(): Promise<ServerMenuCategorySummary[]>`
  - `createMenuItem(input: MenuItemInput): Promise<ServerMenuItem>`
  - `updateMenuItem(id: string, input: Partial<MenuItemInput>): Promise<ServerMenuItem>`
  - `deleteMenuItem(id: string): Promise<void>`
  - `uploadMenuItemImage(id: string, file: File): Promise<ServerMenuItem>`

- [ ] **Step 1: Viết test đỏ** — `src/api/menu.test.ts` mock `globalThis.fetch`; kiểm tra: `createMenuItem` gọi `POST /api/v1/menu/items` với JSON body; `deleteMenuItem` gọi `DELETE .../menu/items/:id` và trả `undefined` khi 204; `uploadMenuItemImage` gửi `FormData` **không** set `Content-Type` thủ công.

- [ ] **Step 2: Chạy để xác nhận đỏ** — `npx vitest run src/api/menu.test.ts` (Expected: FAIL).

- [ ] **Step 3: Sửa `http.ts`** — trong `request`, nếu `options.body instanceof FormData` thì: không `JSON.stringify`, không set `Content-Type`. Giữ nguyên hành vi JSON cho trường hợp khác.

- [ ] **Step 4: Thêm hàm vào `menu.ts`** — theo chữ ký ở Interfaces; `uploadMenuItemImage` tạo `FormData`, `append('file', file)`.

- [ ] **Step 5: Proxy** — `vite.config.ts` thêm mục `'/uploads'` vào `server.proxy` (cùng target `http://localhost:3001`, `changeOrigin: true`).

- [ ] **Step 6: Chạy test xanh** — `npx vitest run src/api/menu.test.ts` (PASS) + `npm run lint`.

- [ ] **Step 7: Commit**

```bash
git add src/api vite.config.ts
git commit -m "feat(web): menu admin API client and image proxy"
```

---

## Task F2: Trang `MenuPage` — danh sách món + phân quyền + nhãn "Tạm hết món"

**Files:**
- Create: `src/pages/MenuPage.tsx`
- Create: `src/lib/menu-image.ts` (hàm `resolveMenuImage(imageUrl, imageKey)`)
- Modify: `src/lib/catalog-map.ts` (dùng `resolveMenuImage`)
- Modify: `src/types.ts` (`MenuItem` thêm `imageUrl?: string | null`)
- Test: `src/pages/MenuPage.test.tsx`

**Interfaces:**
- Consumes: `getMenu`, `getCategories` (Task F1); `useAuthStore` (`user.role`); `resolveMenuImage`.
- Produces: `MenuPage` component (default export `{ MenuPage }` theo mẫu `OrdersPage`).

- [ ] **Step 1: Viết test đỏ** — `src/pages/MenuPage.test.tsx` mock `../api/menu` (`getMenu`, `getCategories`) và `../store/useAuthStore`. Case:
  - OWNER: thấy tên món + nút "Thêm món".
  - CASHIER: **không** thấy nút "Thêm món"/"Sửa"/"Xoá".
  - Món `available=false`: hiển thị chữ **"Tạm hết món"**.

- [ ] **Step 2: Chạy để xác nhận đỏ** — `npx vitest run src/pages/MenuPage.test.tsx` (Expected: FAIL).

- [ ] **Step 3: `resolveMenuImage`** — trả `imageUrl` nếu có, ngược lại `assetFor(imageKey)`. Cập nhật `catalog-map.ts`: `image: resolveMenuImage(item.imageUrl, item.imageKey)`.

- [ ] **Step 4: Viết `MenuPage`** — nạp dữ liệu bằng `useEffect` gọi `Promise.all([getMenu(), getCategories()])`; state `items`, `categories`, `loading`, `error`. `canEdit = role === 'OWNER' || role === 'MANAGER'`. Render danh sách theo nhóm; mỗi dòng: thumbnail (`<img src={resolveMenuImage(...)} />`), tên, giá (`formatCurrency`), nhãn **"Tạm hết món"** khi `!available`. Nút "Thêm món"/"Sửa"/"Xoá" chỉ render khi `canEdit` (hành vi đầy đủ ở Task F3/F4; task này chỉ cần nút hiện/ẩn đúng).

- [ ] **Step 5: Chạy test xanh** — `npx vitest run src/pages/MenuPage.test.tsx` + `npm test` (toàn bộ xanh) + `npm run lint`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/MenuPage.tsx src/pages/MenuPage.test.tsx src/lib/menu-image.ts src/lib/catalog-map.ts src/types.ts
git commit -m "feat(web): menu management page with role-aware actions"
```

---

## Task F3: Modal thêm/sửa món + tải ảnh

**Files:**
- Create: `src/components/menu-management/MenuItemFormModal.tsx`
- Create: `src/components/menu-management/MenuImageField.tsx`
- Modify: `src/pages/MenuPage.tsx`
- Test: `src/components/menu-management/MenuItemFormModal.test.tsx`

**Interfaces:**
- Consumes: `createMenuItem`, `updateMenuItem`, `uploadMenuItemImage`, `MenuItemInput`; `ServerMenuCategorySummary`; `Modal` (`src/components/ui/Modal.tsx`), `Button`.
- Produces:
  - `MenuItemFormModal` props: `{ open: boolean; categories: ServerMenuCategorySummary[]; item?: ServerMenuItem; onClose: () => void; onSaved: () => void }`.
  - `MenuImageField` props: `{ value: File | null; previewUrl: string | null; onChange: (file: File) => void }`.

- [ ] **Step 1: Viết test đỏ** — mock `../api/menu`. Case: mở ở chế độ tạo → submit gọi `createMenuItem` với `{ categoryId, name, price }` (giá số nguyên); mở ở chế độ sửa (có `item`) → submit gọi `updateMenuItem(item.id, ...)`; chọn file ảnh → khi submit gọi `uploadMenuItemImage(id, file)`. Select nhóm **không** chứa `all`/`popular`.

- [ ] **Step 2: Chạy để xác nhận đỏ** — `npx vitest run src/components/menu-management/MenuItemFormModal.test.tsx` (Expected: FAIL).

- [ ] **Step 3: Viết `MenuImageField`** — input `type="file" accept="image/jpeg,image/png,image/webp"`; hiện preview qua `URL.createObjectURL`.

- [ ] **Step 4: Viết `MenuItemFormModal`** — form các trường: `name`, `price` (ép `Number`, validate số nguyên ≥ 0), `categoryId` (select từ `categories` đã lọc bỏ `all`/`popular`), `description`, `popular`, `available`. Submit: tạo/sửa trước, nếu có file mới thì gọi `uploadMenuItemImage(id, file)` sau; gọi `onSaved()` rồi `onClose()`. Lỗi `ApiError` → hiện `message`.

- [ ] **Step 5: Nối vào `MenuPage`** — nút "Thêm món" và "Sửa" mở modal với `item` tương ứng. `onSaved` gọi lại hàm nạp danh sách của trang.

- [ ] **Step 6: Chạy test xanh** — `npx vitest run src/components/menu-management/MenuItemFormModal.test.tsx` + `npm test` + `npm run lint`.

- [ ] **Step 7: Commit**

```bash
git add src/components/menu-management src/pages/MenuPage.tsx
git commit -m "feat(web): create/edit menu item modal with image upload"
```

---

## Task F4: Xoá món (có xác nhận) + nối trang vào app + làm mới catalog

**Files:**
- Modify: `src/pages/MenuPage.tsx` (nút xoá + `ConfirmModal`)
- Modify: `src/App.tsx` (route `menu` → `MenuPage`)
- Test: `src/pages/MenuPage.test.tsx` (thêm case)

**Interfaces:**
- Consumes: `deleteMenuItem`; `ConfirmModal` (`src/components/modals/ConfirmModal.tsx`); `useCatalogStore`.
- Produces: trang `menu` render `MenuPage` thay cho `PlaceholderPage`.

- [ ] **Step 1: Viết test đỏ** — thêm case: OWNER bấm "Xoá" → `ConfirmModal` mở; xác nhận → gọi `deleteMenuItem(id)`; sau khi xoá gọi `useCatalogStore.getState().refresh()`. CASHIER không thấy nút "Xoá".

- [ ] **Step 2: Chạy để xác nhận đỏ** — `npx vitest run src/pages/MenuPage.test.tsx` (Expected: FAIL).

- [ ] **Step 3: Viết luồng xoá** — state `pendingDelete`; mở `ConfirmModal`; xác nhận gọi `deleteMenuItem`, sau đó `useCatalogStore.getState().refresh()` và nạp lại danh sách; lỗi qua toast.

- [ ] **Step 4: Nối `App.tsx`** — thêm nhánh `activePage === 'menu' ? <MenuPage />` trước nhánh `PlaceholderPage`; import `MenuPage`.

- [ ] **Step 5: Chạy test xanh + cổng** — `npm test` (toàn bộ), `npm run lint`, `npm run build`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/MenuPage.tsx src/pages/MenuPage.test.tsx src/App.tsx
git commit -m "feat(web): delete menu item with confirm and wire menu page"
```

---

## Self-Review

- **Spec coverage:** Q1 upload → B3/F3; Q2 phân quyền → B2 (`@Roles`) + F2/F4 (ẩn nút); Q3 không nhóm món → không có task Category CRUD, form chỉ select nhóm có sẵn; Q4 "Tạm hết món" + Xoá → F2 nhãn, B2/F4 xoá; Q5 không offline → các task đều gọi API trực tiếp; Q6 trường sửa → DTO B2 + form F3.
- **Type consistency:** `MenuItemResponse.imageUrl` (B1) ↔ `ServerMenuItem.imageUrl` (F1) ↔ `MenuItem.imageUrl` (F2); `MenuItemInput` (F1) dùng thống nhất ở F3; `setItemImage` (B3) là tên service, route là `.../image`.
- **Review Focus:** mỗi dòng đã gắn test ở B2/B3.
