# RestoDash POS — Báo cáo dự án & cẩm nang bàn giao

> **Phiên bản:** 1.0 — 19/11/2026  
> **Trạng thái:** Frontend POS v1 đã hoàn thành; PR [#1](https://github.com/datnguyentien1910/POS-Food-and-Drink/pull/1) đang mở.  
> **Nhánh:** `feat/restodash-pos` → `main`  
> **Phạm vi:** Frontend dùng thật tại quầy; backend, đăng nhập và đồng bộ nhiều thiết bị để giai đoạn sau.  
> **Vai trò tài liệu:** đây là **nguồn sự thật duy nhất** cho các fork. Đọc file này trước khi đọc code hoặc lập kế hoạch module mới.

## Mục lục

- **0.** Tóm tắt điều hành — đọc trong 5 phút
- **1.** Bối cảnh, mục tiêu và phạm vi
- **2.** Trạng thái dự án
- **3.** Trải nghiệm và quy chuẩn giao diện
- **4.** Kiến trúc kỹ thuật
- **5.** Các quyết định đã chốt (ADR)
- **6.** Bất biến và vùng cấm
- **7.** Đánh giá nhanh (review)
- **8.** Lộ trình phát triển
- **9.** Hợp đồng dữ liệu và API dự kiến
- **10.** Quy trình làm việc cho các fork
- **11.** QA playbook
- **12.** Câu hỏi mở cần chốt
- **13.** Nhật ký dự án
- **Phụ lục A–C.** Thuật ngữ, liên kết, ghi chú

---

## 0. Tóm tắt điều hành — đọc trong 5 phút

### 0.1 Sản phẩm là gì?

RestoDash POS là giao diện bán hàng cho nhà hàng/quán ăn, chạy hoàn toàn trên trình duyệt:

- Thu ngân chọn món → chỉnh giỏ → giảm giá/ghi chú → chọn bàn → thanh toán → in hoá đơn 80mm.
- Đơn đang làm, đơn nháp và lịch sử đơn được lưu trên chính thiết bị, tồn tại qua reload/tắt trình duyệt.
- App là PWA: sau lần tải đầu, vẫn mở và bán được khi mất mạng.
- Giao diện tiếng Việt, tiền VND, tối ưu laptop tại quầy và tablet cảm ứng.

### 0.2 Trạng thái thực tế

| Hạng mục | Trạng thái |
| --- | --- |
| Màn hình POS | **Dùng thật** |
| Màn hình Đơn hàng | **Dùng thật** (lịch sử local) |
| 9 màn hình còn lại | Placeholder có chủ đích |
| Backend/API/đăng nhập/đồng bộ | **Chưa có** |
| Thanh toán ngân hàng/thẻ thật | **Chưa có** — chỉ ghi nhận phương thức |
| Máy in ESC/POS | **Chưa có** — in qua hộp thoại trình duyệt |
| Test | **113/113 pass**, 22 file |
| Lint | `oxlint` sạch |
| Build | Pass; PWA precache 30 entries (~1.64 MB) |
| QA giao diện | 1440×900, 1280×800, 1024×768, 390×844; touch 768×1024 |
| Hoá đơn 80mm | PDF 1 trang, 227×567pt, không tràn ngang |

### 0.3 Năm bất biến không được phá

1. **Không bịa số liệu vận hành.** Khách hàng/Công nợ hiển thị “—” cho tới khi có backend.
2. **Tiền là số nguyên VND.** VAT 8% tính trên tạm tính **sau giảm giá**; giảm giá không vượt tạm tính.
3. **Hoá đơn là snapshot.** Tên món và đơn giá được lưu tại lúc thanh toán, không đọc lại từ menu hiện tại.
4. **In hoá đơn 80mm phải còn 1 trang.** Bản in dùng portal riêng, khổ 80mm, nội dung 72mm.
5. **Dữ liệu hỏng không được làm trắng màn hình.** Persist phải validate; lỗi ghi phải hiện cảnh báo.

### 0.4 Muốn đổi gì thì sửa ở đâu?

| Muốn đổi | Sửa tại |
| --- | --- |
| Tên quán, địa chỉ, VAT, số bàn, thu ngân | `src/config.ts` |
| Món, giá, danh mục, ảnh, nhãn phổ biến | `src/data/menu.ts`, `src/assets/menu/` |
| Bàn và số chỗ | `src/data/tables.ts` |
| Màu, font, breakpoint, animation, CSS in | `src/index.css` |
| Công thức tiền | `src/lib/calc.ts` + `src/lib/calc.test.ts` |
| Lưu trữ, hydrate, mã đơn | `src/store/usePOSStore.ts`, `src/lib/id.ts` |
| Layout, sidebar, topbar | `src/components/layout/` |
| Menu, tìm kiếm món | `src/components/menu/`, `src/lib/menu-query.ts` |
| Giỏ hàng, panel đơn | `src/components/order/` |
| Thanh toán | `src/components/modals/ChargeModal.tsx` |
| Hoá đơn | `src/components/receipt/Receipt.tsx`, `src/components/modals/ReceiptModal.tsx` |
| Tìm kiếm toàn cục | `src/components/search/GlobalSearch.tsx`, `src/lib/global-search.ts` |
| Trang Đơn hàng | `src/pages/OrdersPage.tsx` |
| PWA/manifest/precache | `vite.config.ts`, `public/` |

---

## 1. Bối cảnh, mục tiêu và phạm vi

### 1.1 Bài toán

Quán cần một màn hình bán hàng nhanh tại quầy, không phụ thuộc mạng, không yêu cầu nhân viên học phần mềm phức tạp. Dữ liệu phải sống sót qua reload và tắt máy. Giao diện phải đủ chỉn chu để dùng thật, không phải bản demo.

### 1.2 Người dùng chính

| Vai trò | Nhu cầu chính |
| --- | --- |
| Thu ngân / nhân viên order | Thêm món, sửa số lượng, chọn bàn, thanh toán, in hoá đơn trong vài giây |
| Quản lý ca | Mở lại đơn nháp, tra cứu đơn đã thanh toán, in lại hoá đơn |
| Chủ quán | Sau này: xem doanh thu, món bán chạy, chi phí, nhân viên |
| Kế toán | Sau này: đối soát thanh toán, công nợ, báo cáo |

### 1.3 Mục tiêu v1

- Một đơn từ gọi món → thanh toán → in hoá đơn trong vài giây, không cần chuột phải.
- Reload/tắt trình duyệt không mất đơn đang làm và đơn nháp.
- Giao diện chỉn chu ở 1440px, 1280px, 1024px và tablet; mobile xem và thao tác được.
- Thay menu, tên quán, thuế, số bàn bằng sửa file cấu hình/dữ liệu, không đụng component.
- Không hiển thị số liệu giả trông như thật.

### 1.4 Ngoài phạm vi v1 (có chủ đích)

- Backend, API, cơ sở dữ liệu, đăng nhập thật, phân quyền.
- Đồng bộ nhiều máy/trình duyệt, nhiều tab an toàn.
- Quản lý kho, báo cáo doanh thu thật, đặt bàn, khách hàng, nhân viên.
- Thanh toán điện tử thật (QR ngân hàng, máy quẹt thẻ), tích hợp ESC/POS.
- Đa ngôn ngữ, app mobile cho khách tự đặt món.
- Sao lưu tự động, phục hồi sau mất thiết bị.

### 1.5 Anti-goals

- Không dùng UI kit đóng sẵn để giao diện giống template.
- Không thêm tính năng ngoài phạm vi chỉ để “trông đầy đủ”.
- Không tạo số liệu giả ở nơi gây hiểu nhầm vận hành.
- Không đánh đổi tốc độ thao tác tại quầy để có giao diện phức tạp.

### 1.6 Tiêu chí thành công

- Thu ngân hoàn tất một đơn hàng thông thường trong dưới 60 giây.
- Không mất đơn khi reload hoặc đóng/mở trình duyệt.
- App vẫn bán được khi mất mạng sau lần tải đầu.
- Hoá đơn in ra đúng 1 trang 80mm, đọc được, không cắt chữ.
- Không có màn hình trắng khi dữ liệu local bị hỏng.
- Tablet cảm ứng thao tác được với vùng chạm ≥44×44px.

---

## 2. Trạng thái dự án

### 2.1 Trạng thái từng màn hình

| Màn hình | Trạng thái | Ghi chú |
| --- | --- | --- |
| **POS** | Dùng thật | Menu, giỏ, bàn, giảm giá, ghi chú, thanh toán, in |
| **Đơn hàng** | Dùng thật | Lọc hôm nay/tất cả, tìm mã/bàn, xem và in lại |
| Tổng quan | Placeholder | Sẽ có khi nối backend |
| Bàn | Placeholder | Module tiếp theo sau nền tảng |
| Đặt bàn | Placeholder | Phụ thuộc Bàn + Khách hàng |
| Thực đơn | Placeholder | Hiện sửa bằng file dữ liệu |
| Khách hàng | Placeholder | Phụ thuộc backend |
| Báo cáo | Placeholder | Phụ thuộc đơn hàng/chi phí thật |
| Chi phí | Placeholder | Phụ thuộc backend |
| Nhân viên | Placeholder | Phụ thuộc auth/phân quyền |
| Cài đặt | Placeholder | Phụ thuộc backend |

### 2.2 Chất lượng hiện tại

| Kiểm tra | Kết quả |
| --- | --- |
| `npm test` | 113 pass / 22 file |
| `npm run lint` | Pass (`oxlint`) |
| `npm run build` | Pass; TypeScript strict + Vite build |
| PWA | `dist/sw.js`, `dist/manifest.webmanifest`, `dist/registerSW.js` |
| Precache | 30 entries, 1643.50 KiB |
| Bundle | JS ~321 KB (~96.5 KB gzip), CSS ~45.9 KB (~10.9 KB gzip) |
| QA desktop | 1440×900, 1280×800, 1024×768 |
| QA mobile | 390×844 |
| QA touch | 768×1024, `pointer: coarse` |
| In hoá đơn | 80mm, 1 trang, 227×567pt |

### 2.3 Tài sản bàn giao

**Có trong repo:**

- Toàn bộ source code frontend, cấu hình build, PWA.
- README hướng dẫn chạy/build/deploy.
- Spec thiết kế và plan triển khai trong `docs/superpowers/`.
- Ảnh giao diện trong `docs/screenshots/`.
- Ảnh món WebP + giấy phép trong `src/assets/menu/CREDITS.md`.
- Test tự động cho logic, store và các luồng chính.

**Không có trong repo:**

- Backend, database, API contract đã chốt, auth, phân quyền.
- Dữ liệu bán hàng thật, ảnh món thật của quán.
- Script QA Playwright nội bộ (nằm ngoài repo, chỉ dùng trên máy phát triển).
- CI/CD, monitoring, error tracking.
- Tài liệu vận hành máy in/ngân hàng.

### 2.4 Điều đã hoàn thành

- App shell 11 mục, sidebar thu gọn/drawer, topbar, tìm kiếm toàn cục, toast.
- Menu 16 món, 6 danh mục, tìm không dấu, lọc phổ biến, sắp xếp giá, tải thêm.
- Giỏ hàng, chọn bàn/mang đi, ghi chú, giảm giá tiền/%, VAT 8%.
- Thanh toán tiền mặt (tiền thừa, chặn thu thiếu), chuyển khoản, thẻ.
- Lưu/mở/xoá đơn nháp; cảnh báo thay thế đơn đang làm trong luồng Đơn nháp (tìm kiếm toàn cục còn thiếu cảnh báo — xem §7.2).
- Lịch sử đơn, mã `HD-YYYYMMDD-NNN`, xem/in lại hoá đơn.
- Persist có version, validate cấu trúc, cảnh báo lỗi ghi.
- PWA offline, manifest, icon, autoUpdate.
- Responsive và touch target cho tablet.
- In hoá đơn 80mm qua portal, CSS in riêng.

---

## 3. Trải nghiệm và quy chuẩn giao diện

### 3.1 Bố cục responsive

| Kích thước | Sidebar | Panel đơn | Menu grid | Ghi chú |
| --- | --- | --- | --- | --- |
| ≥1440px | Đầy đủ 268px | Cột phải 360px | 4 cột | Layout chuẩn desktop |
| 1280–1439px | Đầy đủ 268px | Cột phải 360px | 3 cột | Giá không bị wrap |
| 1024–1279px | Thu gọn 84px | Cột phải 320px | 3 cột | Sidebar icon |
| 768–1023px | Drawer | Drawer + thanh đáy | 3 cột | Tablet |
| <768px | Drawer | Drawer + thanh đáy | 2 cột | Mobile |

- Sidebar tự mở khi vượt 1280px, tự thu gọn khi xuống dưới.
- Panel đơn là cột cố định từ 1024px; dưới 1024px chuyển thành drawer mở bằng nút “Xem đơn”.
- Thanh tổng tiền cố định dưới đáy ở <1024px.
- Hai thẻ “Khách hàng” và “Công nợ” ẩn dưới 1024px để không chiếm chỗ.
- Card “Mẹo nhanh” trong sidebar ẩn khi chiều cao ≤740px.

### 3.2 Design tokens

| Token | Giá trị |
| --- | --- |
| Nền | `#F9F8FA` |
| Card | `#FFFFFF` |
| Viền | `#ECE8F1` |
| Chữ chính | `#1C1514` |
| Chữ phụ | `#7A7370` |
| Primary | `#241EB2` |
| Primary hover | `#1D1893` |
| Primary soft | `#EEECFF` |
| Tích cực | `#668E77` |
| Cảnh báo/giảm | `#BA5118` |
| Vàng nhấn | `#D8A047` |
| Nâu phụ | `#58453B` |
| Font | Plus Jakarta Sans Variable |
| Bo card | 16px |
| Breakpoint `3xl` | 90rem / 1440px |

- Token khai báo trong `@theme` của `src/index.css`.
- Hiệu ứng CSS thuần: phần lớn 150–220ms; drawer 240ms, pop 280ms, zoom ảnh menu 300ms. Tôn trọng `prefers-reduced-motion`.
- Focus ring 2px màu primary, offset 2px.

### 3.3 Thành phần chính

| Nhóm | Thành phần |
| --- | --- |
| UI primitives | `Button`, `IconButton`, `Badge`, `Modal`, `Popover`, `Stepper`, `Toast`, `EmptyState` |
| Layout | `AppShell`, `Sidebar`, `TopBar`, `StorageWarning`, `Avatar`, `Clock` |
| Menu | `MenuPanel`, `CategoryTabs`, `MenuGrid`, `MenuCard` |
| Đơn hàng | `OrderPanel`, `CartRow`, `OrderSummary`, `TableBadge`, `NoteEditor` |
| Modal | `ChargeModal`, `TableModal`, `DiscountModal`, `DraftsModal`, `ReceiptModal`, `ConfirmModal` |
| Khác | `GlobalSearch`, `StatsCards`, `Receipt` |

- Modal dùng `<dialog>` native: focus trap, Esc, backdrop.
- Toast dùng `aria-live="polite"`, tự tắt sau 3 giây.
- Không dùng router ở v1; chuyển trang bằng state trong `App.tsx`.

### 3.4 Tương tác và accessibility

- Mọi nút icon có `aria-label`; nút có text dùng text.
- Focus ring rõ ràng; modal đóng bằng Esc; click backdrop đóng.
- Vùng chạm mở rộng ≥44×44px khi `pointer: coarse` bằng lớp `.touch-target` và media query.
- Bàn phím: `Ctrl/⌘ K` mở tìm kiếm toàn cục; ↑/↓ chọn kết quả; Enter hành động; Esc đóng.
- Ảnh món có `alt` theo tên món.
- Bảng màu đủ tương phản cho chữ chính/phụ trên nền trắng.
- Chưa có audit screen reader độc lập; đây là việc nên làm trước khi mở rộng.

### 3.5 In hoá đơn

- Sau thanh toán, mở `ReceiptModal`; bản in là một cây riêng portal ra `<body>` với class `.print-area`.
- CSS in ẩn mọi phần tử khác của body, đặt `@page { size: 80mm auto; margin: 4mm; }`.
- Nội dung hoá đơn rộng 72mm; tên món/ghi chú dài tự xuống dòng.
- Đã kiểm tra bằng PDF thật: 1 trang, 227×567pt.
- Chưa gửi lệnh trực tiếp tới máy in ESC/POS; dùng hộp thoại in của trình duyệt.

### 3.6 PWA và offline

- `vite-plugin-pwa` chế độ `autoUpdate`.
- Precache JS, CSS, HTML, SVG, PNG, WebP, WOFF2; navigate fallback `index.html`.
- Service worker chỉ chạy ở bản build/preview hoặc HTTPS, không chạy ở dev.
- Dữ liệu bán hàng không phụ thuộc mạng; lần tải đầu và cập nhật bản mới cần mạng.
- Manifest: tên RestoDash POS, tiếng Việt, theme `#241EB2`, standalone.
- **Lưu ý:** manifest đang hardcode tên/theme trong `vite.config.ts`; đổi brand phải sửa cả `src/config.ts` và `vite.config.ts`, không chỉ một file.

### 3.7 Ngôn ngữ và định dạng

- Giao diện tiếng Việt; không có i18n động.
- Tiền tệ VND, `Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })`, hậu tố `₫`.
- Ngày giờ dạng `HH:mm`, `DD/MM/YYYY`; tính theo múi giờ thiết bị.
- Mã đơn `HD-YYYYMMDD-NNN`, tăng theo lịch sử local trong ngày.

---

## 4. Kiến trúc kỹ thuật

### 4.1 Stack và lý do

| Thành phần | Lựa chọn | Lý do |
| --- | --- | --- |
| UI | React 19 | Hệ sinh thái, component test, phù hợp SPA |
| Build | Vite 8 | Nhanh, cấu hình gọn, build tĩnh |
| Ngôn ngữ | TypeScript strict | An toàn domain tiền/đơn hàng |
| Style | Tailwind CSS 4 | Token nhất quán, không kéo UI kit |
| State | Zustand 5 + persist | Nhẹ, chọn slice dễ, persist localStorage |
| Icon | lucide-react | Đồng bộ, nhẹ, dễ dùng |
| Font | Plus Jakarta Sans self-host | Chạy offline, không phụ thuộc Google Fonts |
| Test | Vitest + Testing Library | Nhanh, jsdom, quen thuộc |
| PWA | vite-plugin-pwa | Manifest + Workbox, autoUpdate |
| Lint | oxlint | Nhanh, thay eslint trong plan gốc |

### 4.2 Luồng dữ liệu

```text
MenuPanel ──addItem──▶ usePOSStore ──persist──▶ localStorage
                           │
OrderPanel ──calcTotals────┘
     │
     ├── saveDraft ──▶ drafts
     └── onCharge ──▶ ChargeModal ──completeOrder──▶ history
                                                   │
                                                   ▼
                                             ReceiptModal ──print──▶ 80mm

GlobalSearch ──searchEverything──▶ menu + drafts + history
```

- UI state (modal, drawer, search, filter) nằm trong React local state.
- Domain state (cart, table, discount, note, drafts, history) nằm trong Zustand.
- Store không phụ thuộc component; có thể thay lớp lưu trữ sau này.

### 4.3 Cây thư mục

```text
src/
  main.tsx              mount React, import font + CSS
  App.tsx               page switch, modal thanh toán/hoá đơn
  config.ts             brand, địa chỉ, VAT, số bàn, danh sách trang
  types.ts              domain types
  index.css             theme, animation, touch, print CSS
  assets/menu/          16 ảnh WebP + CREDITS.md
  data/
    menu.ts             16 món, 6 danh mục
    tables.ts           12 bàn, số chỗ
  lib/
    calc.ts             subtotal, discount, VAT, total
    format.ts           VND, giờ, ngày
    id.ts               UUID, lineId, mã đơn
    search.ts           bỏ dấu tiếng Việt, matchesQuery
    menu-query.ts       lọc/sắp xếp/tải thêm
    global-search.ts    gộp kết quả món + nháp + hoá đơn
  store/
    usePOSStore.ts      Zustand persist + validate + storage error
  components/
    layout/             AppShell, Sidebar, TopBar, StorageWarning...
    menu/               MenuPanel, MenuGrid, MenuCard, CategoryTabs
    order/              OrderPanel, CartRow, OrderSummary, TableBadge
    modals/             Charge, Table, Discount, Drafts, Receipt, Confirm
    receipt/            Receipt
    search/             GlobalSearch
    stats/              StatsCards
    ui/                 Button, IconButton, Modal, Popover, Toast...
  pages/
    POSPage.tsx         màn hình bán hàng
    OrdersPage.tsx      lịch sử đơn
    PlaceholderPage.tsx 9 trang chờ backend
  test/setup.ts         jest-dom, cleanup, dialog polyfill, viewport 1440×900
docs/
  superpowers/specs/    thiết kế đã duyệt
  superpowers/plans/    plan frontend (11 task) + backend (9 task)
  screenshots/          ảnh desktop/1024/mobile
public/                 favicon, icon PWA
```

### 4.4 Domain model

| Type | Trường chính | Ghi chú |
| --- | --- | --- |
| `MenuItem` | `id`, `name`, `description?`, `price`, `category`, `image`, `popular?` | Giá đọc tại thời điểm tính tiền |
| `TableOption` | `id`, `name`, `seats` | 12 bàn sinh từ config |
| `CartLine` | `lineId`, `menuItemId`, `qty` | `lineId` độc lập với món |
| `Discount` | `type: amount \| percent`, `value` | Không vượt tạm tính |
| `Draft` | `id`, `tableId`, `items`, `discount`, `note`, `createdAt` | Bản sao giỏ tại lúc lưu |
| `OrderLineSnapshot` | `menuItemId`, `name`, `unitPrice`, `qty` | Snapshot lúc thanh toán |
| `OrderRecord` | `id`, `code`, `tableId`, `tableName`, `items`, `subtotal`, `discountAmount`, `tax`, `total`, `method`, `received?`, `change?`, `note`, `createdAt`, `cashier` | Lịch sử local |
| `Totals` | `subtotal`, `discountAmount`, `tax`, `total` | Kết quả tính tiền |

### 4.5 Store và persistence

**Key:** `restodash-pos-v1`  
**Version:** `1`

**Persist các trường:** `cart`, `tableId`, `discount`, `note`, `drafts`, `history`.  
**Không persist:** UI state, `storageError`.

**Cơ chế an toàn:**

- `getItem` parse JSON, kiểm tra `version === 1`, validate toàn bộ cấu trúc bằng type guard.
- Dữ liệu hỏng/sai shape/version lạ → trả `null`, hydrate mặc định, không crash.
- `setItem` bắt lỗi quota/private mode; bật `storageError`.
- `StorageWarning` hiện banner cố định khi `storageError = true`; tự tắt khi ghi thành công trở lại.
- `partialize` chỉ ghi domain state, không ghi action.

**Hành vi chính:**

- `addItem`: nếu món đã có thì tăng `qty`, chưa có thì tạo `lineId` mới.
- `decrement`: giảm; về 0 thì xoá dòng.
- `clearCart`: **hiện chỉ xoá `cart`**, giữ nguyên `tableId`, `discount`, `note`; nút “Xoá đơn” chưa có `ConfirmModal`. Đây là hạn chế đã biết — xem §7.2.
- `saveDraft`: chỉ lưu khi giỏ có món; snapshot giỏ rồi làm trống đơn hiện tại.
- `loadDraft`: nạp lại giỏ/bàn/giảm giá/ghi chú và xoá nháp khỏi danh sách.
- `completeOrder`: snapshot món, tính totals, sinh mã, thêm vào đầu `history`, làm trống đơn.

**Giới hạn:** một thiết bị, một tab. Mở nhiều tab có thể ghi đè lẫn nhau. Chưa có migration ngoài version 1.

### 4.6 Tính tiền

```text
subtotal      = Σ round(unitPrice) × floor(qty)        (bỏ dòng giá/qty không hợp lệ)
discountAmount = min(round(amount hoặc subtotal × %), subtotal)
taxable       = max(0, subtotal − discountAmount)
tax           = round(taxable × 0.08)
total         = taxable + tax
```

- Tất cả VND số nguyên; làm tròn từng bước.
- Giảm giá âm/không hữu hạn → 0.
- Thuế suất lấy từ `RESTAURANT.taxRate` (mặc định 0.08).
- Test tại `src/lib/calc.test.ts`.

### 4.7 Tìm kiếm và ID

- `normalizeText`: NFD, bỏ dấu, `đ → d`, lowercase, gộp khoảng trắng.
- Tìm món theo tên + mô tả; tìm đơn theo mã, bàn, ghi chú, thu ngân, tên món.
- Tìm kiếm toàn cục giới hạn 5 món, 3 nháp, 4 hoá đơn; điều hướng bằng bàn phím.
- `makeId`: `crypto.randomUUID()` nếu có, fallback timestamp + random.
- `makeLineId`: `line-<uuid>`.
- `nextOrderCode`: tìm số lớn nhất trong history cùng prefix ngày, cộng 1, pad 3.

### 4.8 Build, test, lint

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 113 test
npm run lint       # oxlint
npm run build      # tsc -b + vite build
npm run preview    # chạy bản build/PWA
```

- Node yêu cầu: `^20.19.0` hoặc `>=22.12.0`.
- Test chạy jsdom, setup tại `src/test/setup.ts`.
- Build tĩnh vào `dist/`; deploy hosting tĩnh bất kỳ.
- PWA cần HTTPS hoặc localhost.
- `tsconfig.app.json` hiện không ghi `strict`; TypeScript 7 mặc định strict. Nếu hạ TS <6 hoặc đổi compiler, bật `strict: true` tường minh.

### 4.9 Giới hạn kiến trúc hiện tại

- **Một store lớn** cho toàn bộ POS; chưa tách slice theo module.
- **Chưa có router**; `App.tsx` chuyển trang bằng state, không deep-link/back button.
- **Chưa có lớp service/repository**; component gọi trực tiếp store và data tĩnh.
- **Chưa có ErrorBoundary**; lỗi render ngoài dự kiến có thể trắng màn hình.
- **Chưa có CI**; test/lint/build chạy local.
- **Chưa có E2E tự động trong repo**; QA Playwright nằm ngoài repo.
- **Menu tĩnh**; muốn đổi món phải sửa code/data và build lại.
- **Một tab/một thiết bị**; chưa có khóa hay đồng bộ.
- **Chưa có migration** khi schema thay đổi; mới dừng ở version 1.

---

## 5. Các quyết định đã chốt (ADR)

> Khi fork muốn thay đổi một quyết định dưới đây, phải đề xuất và ghi lại lý do; không sửa âm thầm.

| ID | Quyết định | Lý do | Hệ quả |
| --- | --- | --- | --- |
| ADR-01 | React + Vite + TypeScript + Tailwind, SPA tĩnh | POS nội bộ, không cần SSR; build nhẹ, deploy tĩnh | Không có SEO/server rendering; cần HTTPS cho PWA |
| ADR-02 | Không dùng router ở v1 | Giảm phức tạp cho 2 màn hình thật | Khi thêm module phải bổ sung router/deep-link |
| ADR-03 | Zustand persist localStorage | Đơn giản, offline, không cần backend | Một thiết bị/tab; cần thay lớp service khi có API |
| ADR-04 | Tiền VND số nguyên, làm tròn từng bước | Tránh sai số floating point | Không dùng số thập phân cho tiền |
| ADR-05 | Hoá đơn snapshot tên/giá | Sửa menu không làm sai lịch sử | `OrderLineSnapshot` là bắt buộc |
| ADR-06 | `oxlint` thay eslint | Nhanh, đủ gate hiện tại | Rule parity với eslint không tuyệt đối |
| ADR-07 | Menu 3 cột 1024–1439px, 4 cột ≥1440px | 4 cột ở 1024–1279 làm giá bị wrap khi mở panel đơn | Khác spec gốc 1 cột ở 1280–1439 |
| ADR-08 | Bản in portal ra `<body>`, 80mm/72mm | Ẩn layout app, tránh trang trắng; kiểm tra PDF 1 trang | `@page 80mm` cũng ảnh hưởng Ctrl+P thường |
| ADR-09 | Placeholder không hiển thị số liệu giả | Tránh hiểu nhầm vận hành | Khách/Công nợ hiện “—”; trang chờ backend |
| ADR-10 | PWA `autoUpdate` | Đơn giản cho quán, không cần thao tác cập nhật | Có thể cần reload một lần sau bản mới |
| ADR-11 | Không UI kit/motion library | Kiểm soát giao diện, bundle nhẹ | Phải tự viết component/animation |
| ADR-12 | Một thiết bị/một tab | Chưa có backend đồng bộ | Không mở nhiều tab POS cùng lúc |

---

## 6. Bất biến và vùng cấm

| Bất biến | Vì sao | Nơi kiểm tra |
| --- | --- | --- |
| Không bịa số liệu vận hành | Gây quyết định sai | `StatsCards.tsx`, `PlaceholderPage.tsx` |
| Tiền VND số nguyên, VAT sau giảm giá | Đúng kế toán, tránh sai số | `src/lib/calc.ts`, `calc.test.ts` |
| Giảm giá không vượt tạm tính | Không âm tiền | `calcDiscount` |
| Hoá đơn snapshot tên/giá | Sửa menu không làm sai lịch sử | `OrderLineSnapshot`, `completeOrder` |
| Mã đơn không trùng trong ngày | Tra cứu/đối soát | `nextOrderCode`, `id.test.ts` |
| Persist sai shape không crash | Không trắng màn hình | `isPersistedPOS`, store tests |
| Lỗi ghi localStorage phải cảnh báo | Không mất đơn âm thầm | `StorageWarning`, store tests |
| In 80mm 1 trang | Hoá đơn dùng thật | `index.css`, `ReceiptModal` |
| Touch target ≥44px | Tablet cảm ứng | `.touch-target`, media query |
| Tôn trọng reduced motion | Accessibility | `@media (prefers-reduced-motion)` |
| PWA build ra đủ manifest/sw | Offline | `vite.config.ts`, `npm run build` |
| Không đổi key/version persist tùy tiện | Mất dữ liệu người dùng | `STORAGE_KEY`, `version` |

---

## 7. Đánh giá nhanh (review)

### 7.1 Điểm mạnh

- **Domain rõ ràng:** types tách biệt, tiền/đơn hàng có snapshot, không trộn UI với nghiệp vụ.
- **Test có giá trị:** 113 test tập trung vào tính tiền, store, tìm kiếm, luồng chính; không phải test hình thức.
- **Persistence được gia cố:** validate shape/version, cảnh báo lỗi ghi — hiếm dự án frontend nhỏ làm đủ.
- **In hoá đơn thực dụng:** đã kiểm tra PDF thật, xử lý tên dài, không chỉ “CSS đẹp”.
- **Responsive có chủ đích:** 4 kích thước, touch target, breakpoint menu hợp lý.
- **Không fake số liệu:** giữ đúng nguyên tắc sản phẩm.
- **Cấu hình tách khỏi component:** đổi quán/menu/thuế không cần sửa UI.
- **PWA sẵn sàng:** build ra manifest/service worker, precache đầy đủ.

### 7.2 Điểm cần cải thiện

**P0 — trước khi mở module mới:**

1. **Router + deep-link.** Thêm React Router (hoặc route map) để mỗi module có URL, back/forward hoạt động.
2. **Tách store theo miền.** `pos`, `tables`, `reservations`, `staff`, `customers`, `settings`; tránh một store khổng lồ.
3. **Lớp service/repository.** Component không gọi trực tiếp localStorage; định nghĩa interface để thay adapter local → HTTP.
4. **ErrorBoundary.** Lỗi render không được làm trắng toàn app.
5. **CI.** Chạy lint + test + build trên mỗi PR.
6. **E2E smoke trong repo.** Ít nhất luồng thêm món → thanh toán → in; QA hiện tại nằm ngoài repo.
7. **Sửa “Xoá đơn”:** phải có xác nhận và reset toàn bộ đơn (bàn/giảm giá/ghi chú), không chỉ `cart`; hiện đơn sau có thể thừa hưởng dữ liệu cũ.

**P1 — nên làm sớm:**

7. Migration schema (version 2+) có test.
8. Sửa tìm kiếm toàn cục: mở đơn nháp không được âm thầm lưu giỏ hiện tại; hỏi xác nhận như `DraftsModal`.
9. Giới hạn `@page 80mm` chỉ khi in hoá đơn, không ảnh hưởng Ctrl+P thường.
10. Thêm `loading="lazy"` cho ảnh menu.
11. Audit accessibility: screen reader, focus order, contrast.
12. Tách `StatsCards` khỏi lịch sử local khi có backend; hiện là số liệu local, cần ghi rõ.

**P2 — khi có nhu cầu:**

13. Phân tích bundle, code-splitting theo route.
14. i18n nếu mở rộng ngôn ngữ.
15. Telemetry/error tracking (không chứa dữ liệu khách).
16. Storybook hoặc catalog component nếu đội UI lớn.

### 7.3 Rủi ro nếu mở rộng ngay

| Rủi ro | Hậu quả | Giảm thiểu |
| --- | --- | --- |
| Thêm module vào store hiện tại | Store phình, khó test, tranh chấp state | Tách slice/service trước |
| Không có router | Không deep-link, khó back, khó phân quyền theo route | Thêm router ở Phase 0 |
| Dùng localStorage cho dữ liệu dùng chung | Mỗi máy một dữ liệu, xung đột | Backend + sync trước Bàn/Đặt bàn |
| Không có auth | Ai cũng sửa được dữ liệu | Auth + role ở Phase 1 |
| Không có CI/E2E | Regression lọt vào bản dùng thật | CI + smoke E2E |
| Không có ErrorBoundary | Một lỗi nhỏ trắng cả app | Thêm ngay Phase 0 |
| Ảnh stock | Không đúng món, vấn đề bản quyền | Thay ảnh thật trước khi dùng |

### 7.4 Kết luận review

Đây là một **v1 frontend tốt, dùng được thật**, không phải prototype. Nền tảng domain/test/persistence đủ chắc để tiếp tục. Điểm yếu chính không nằm ở UI mà ở **kiến trúc mở rộng**: chưa có router, service layer, auth, CI và đồng bộ. Vì vậy fork tiếp theo nên dành một phase ngắn gia cố nền tảng trước khi thêm Bàn/Đặt bàn/Nhân viên.

---

## 8. Lộ trình phát triển

### 8.1 Nguyên tắc

- **UI-first, backend-ready:** mỗi module có thể làm UI với adapter local, nhưng phải định nghĩa interface/service để thay API sau.
- **Không fake số liệu:** nếu chưa có dữ liệu, hiện empty state/“—”, không bịa.
- **Một module một PR:** không trộn refactor hạ tầng với tính năng.
- **Giữ POS luôn chạy:** mọi thay đổi phải chạy full test và smoke flow POS.
- **Cập nhật tài liệu:** mỗi module xong phải cập nhật `PROJECT.md` + README + test.

### 8.2 Phase 0 — Gia cố nền tảng (khuyến nghị 1–2 ngày)

**Mục tiêu:** làm cho việc thêm module không phá v1.

- Thêm router/deep-link; route table cho 11 trang.
- Tách `usePOSStore` thành slice hoặc feature store; giữ API tương thích.
- Thêm `services/` + repository interface cho POS, menu, orders.
- Thêm `ErrorBoundary` + trang lỗi.
- Thêm CI (lint/test/build) và smoke E2E.
- Thêm migration helper cho persist (chuẩn bị version 2).
- Sửa các P1 nhỏ (global search, print scope, lazy ảnh).

**Done khi:** POS vẫn 113 test + smoke pass; router hoạt động; không đổi hành vi người dùng.

### 8.3 Phase 1 — Nền tảng backend (backend-only, ~2,5 tuần)

**Mục tiêu:** backend chạy local, sẵn sàng để Phase 2 nối frontend; **không thay đổi frontend** trong phase này.

- Stack: NestJS 12.5 + PostgreSQL 17 (Docker) + Prisma 7.10.1 + session auth.
- Schema: restaurant, user/membership, device, category/menu item, table, order/order item/payment, audit, idempotency, order counter.
- Auth: email/password + PIN 4 số gắn thiết bị; role Owner/Manager/Cashier.
- API: auth, devices, menu/tables read-only, orders/payments, void, audit, health; prefix `/api/v1`, Swagger `/api/docs`.
- Chưa làm: nối frontend, offline sync, CRUD menu/nhân viên, trạng thái bàn, báo cáo, deploy VPS.

**Tài liệu:** [Spec](docs/superpowers/specs/2026-11-19-backend-foundation-spec.md) · [Plan](docs/superpowers/plans/2026-11-19-backend-foundation-plan.md)

**Done khi:** backend chạy sạch bằng Docker + seed; auth/order/void/idempotency pass; CI xanh; frontend vẫn 113/113; `src/` không đổi.

### 8.4 Phase 2 — Bàn (3–5 ngày)

**Mục tiêu:** sơ đồ bàn và trạng thái phục vụ.

- Data: `Table` (id, name, zone, seats, status, currentOrderId, updatedAt), `TableZone`.
- UI: sơ đồ bàn, trạng thái trống/đang phục vụ/đặt trước/dọn dẹp; mở đơn theo bàn.
- Hành vi: gộp bàn, chuyển bàn, tách bàn, mang đi.
- API: CRUD bàn, cập nhật trạng thái, khóa bàn theo phiên.
- Realtime/SSE nếu nhiều thiết bị.

**Done khi:** thu ngân mở đơn từ sơ đồ bàn; trạng thái đồng bộ giữa hai máy; không mất đơn khi chuyển bàn.

### 8.5 Phase 3 — Đặt bàn (3–5 ngày)

**Mục tiêu:** lịch đặt bàn và kiểm tra chỗ.

- Data: `Reservation` (id, code, customerId?, name, phone, partySize, tableIds, startAt, duration, status, note, source).
- UI: lịch ngày/tuần, form đặt, trạng thái chờ/xác nhận/đã đến/huỷ/no-show.
- Logic: kiểm tra trùng bàn, thời lượng, sức chứa; gợi ý bàn.
- Liên kết: khách hàng, bàn, ghi chú.
- Thông báo nhắc lịch (sau này).

**Done khi:** đặt bàn không trùng; lễ tân xem được lịch ngày; chuyển reservation → bàn/đơn.

### 8.6 Phase 4 — Nhân viên và ca (3–4 ngày)

**Mục tiêu:** ai làm gì, ca nào, quyền nào.

- Data: `Staff`, `Role`, `Shift`, `AuditLog`.
- UI: danh sách nhân viên, phân quyền, mở/đóng ca, bàn giao tiền mặt.
- Auth: PIN/mật khẩu (hash server-side), session, đăng xuất.
- Audit: ai thanh toán, ai huỷ, ai sửa giá.
- Báo cáo ca: doanh thu, số đơn, chênh lệch tiền mặt.

**Done khi:** thu ngân đăng nhập bằng tài khoản; quản lý xem ca; thao tác nhạy cảm có audit.

### 8.7 Phase 5 — Thực đơn và khách hàng (2–3 ngày mỗi module)

**Thực đơn:**

- CRUD món/danh mục, giá, ảnh, trạng thái còn/hết.
- Lịch sử giá; không sửa snapshot hoá đơn cũ.
- Upload ảnh, resize WebP, giới hạn dung lượng.

**Khách hàng:**

- Hồ sơ, số điện thoại duy nhất, lịch sử ghé, tổng chi tiêu, tích điểm.
- Gắn khách vào đơn/đặt bàn; tìm không dấu.
- Quyền riêng tư: không lộ số điện thoại trên màn hình công khai.

### 8.8 Phase 6 — Báo cáo, chi phí, tổng quan (4–6 ngày)

- Doanh thu theo ngày/giờ/tháng; theo phương thức thanh toán; theo nhân viên.
- Món bán chạy, biên lợi nhuận (cần giá vốn).
- Chi phí: nguyên liệu, vận hành, lương; trạng thái thanh toán.
- Tổng quan: KPI thật từ backend, không dùng số local.
- Xuất CSV/PDF nếu cần.

### 8.9 Phase 7 — Cài đặt, thanh toán, in (liên tục)

- Thông tin quán, thuế, phí phục vụ, mẫu hoá đơn.
- Máy in ESC/POS (WebUSB/WebSerial hoặc print agent), test trên thiết bị thật.
- QR ngân hàng, máy quẹt thẻ, đối soát giao dịch.
- Sao lưu/khôi phục, nhật ký lỗi.

### 8.10 Thứ tự ưu tiên

```text
Phase 0  Gia cố nền tảng
   │
Phase 1  Backend + auth (backend-only)
   │
   ├── Phase 2  Bàn
   │      │
   │      └── Phase 3  Đặt bàn
   │
   ├── Phase 4  Nhân viên + ca
   │
   ├── Phase 5  Thực đơn + Khách hàng
   │
   └── Phase 6  Báo cáo + Chi phí + Tổng quan
          │
          └── Phase 7  Cài đặt + thanh toán + in
```

**Lý do thứ tự:** Bàn/Đặt bàn cần dữ liệu chung và auth; làm trước sẽ phải viết lại. Báo cáo cần đơn hàng/chi phí thật. Nhân viên/role nên có trước khi mở quyền sửa giá/huỷ đơn.

---

## 9. Hợp đồng dữ liệu và API dự kiến

> Đây là **định hướng**, chưa phải hợp đồng đã chốt. Fork phải cập nhật khi backend được thiết kế.

### 9.1 Thực thể dự kiến

| Thực thể | Trường chính |
| --- | --- |
| `Restaurant` | id, name, address, phone, taxRate, currency, timezone |
| `Staff` | id, name, role, pinHash?, status, createdAt |
| `Role` | id, name, permissions[] |
| `Shift` | id, staffId, startedAt, endedAt, openingCash, closingCash, note |
| `Table` | id, name, zone, seats, status, currentOrderId?, updatedAt |
| `Reservation` | id, code, customerId?, name, phone, partySize, tableIds[], startAt, durationMin, status, note |
| `Category` | id, name, sortOrder, active |
| `MenuItem` | id, categoryId, name, description, price, costPrice?, image, available, sortOrder |
| `Customer` | id, name, phone, email?, points, totalSpent, lastVisitAt, note |
| `Order` | id, code, tableId?, customerId?, staffId, channel, status, items[], totals, note, createdAt, paidAt |
| `Payment` | id, orderId, method, amount, received?, change?, reference?, status |
| `Expense` | id, category, amount, paidAt, supplier?, note, attachment? |
| `AuditLog` | id, actorId, action, entity, entityId, before?, after?, createdAt |

### 9.2 API sketch

```text
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/me

GET    /api/menu
POST   /api/menu/items
PATCH  /api/menu/items/:id
DELETE /api/menu/items/:id

GET    /api/tables
PATCH  /api/tables/:id
POST   /api/tables/:id/open-order
POST   /api/tables/:id/merge
POST   /api/tables/:id/move

GET    /api/reservations?date=
POST   /api/reservations
PATCH  /api/reservations/:id
POST   /api/reservations/:id/check-in

GET    /api/orders?from=&to=&status=
POST   /api/orders
POST   /api/orders/:id/payments
POST   /api/orders/:id/void
GET    /api/orders/:id

GET    /api/customers?q=
POST   /api/customers
PATCH  /api/customers/:id

GET    /api/reports/revenue?from=&to=
GET    /api/reports/top-items?from=&to=
GET    /api/expenses?from=&to=
POST   /api/expenses

GET    /api/staff
POST   /api/staff
PATCH  /api/staff/:id
GET    /api/shifts
POST   /api/shifts/open
POST   /api/shifts/:id/close
```

### 9.3 Auth và phân quyền

- Session cookie httpOnly + secure; không lưu token dài hạn trong localStorage.
- Role tối thiểu: `owner`, `manager`, `cashier`, `server`, `kitchen`.
- Quyền nhạy cảm: sửa giá, huỷ đơn, hoàn tiền, đóng ca, xem báo cáo, quản lý nhân viên.
- PIN chỉ dùng cho thao tác nhanh tại quầy; hash ở server, không lưu plaintext.
- Mọi thao tác huỷ/sửa giá/hoàn tiền ghi `AuditLog`.

### 9.4 Offline và đồng bộ

- POS phải bán được khi mất mạng: queue thao tác local (outbox).
- Mỗi thao tác có `idempotencyKey` do client sinh; server chống ghi trùng.
- Đơn local có `clientId` ổn định; server trả `serverId`.
- Xung đột bàn/đặt bàn: server authoritative + version/updatedAt; client hiện cảnh báo và tải lại.
- Không tự động merge hai đơn cùng bàn nếu không có quy tắc rõ.
- Khi có mạng lại: đẩy outbox theo thứ tự, báo lỗi từng mục, không chặn bán hàng.

### 9.5 Migration từ localStorage

- Giữ nguyên key `restodash-pos-v1` trong giai đoạn chuyển tiếp.
- Lần đầu đăng nhập: đọc local, POST `/api/import` một lần, lưu backup JSON.
- Không xoá local ngay; chỉ xoá sau khi server xác nhận và người dùng đồng ý.
- Menu local và menu server: server thắng; hoá đơn cũ vẫn giữ snapshot.

---

## 10. Quy trình làm việc cho các fork

### 10.1 Session gốc

Session này là **nơi chốt kế hoạch**. Fork không tự đổi hướng kiến trúc. Quy trình:

1. Đọc `PROJECT.md` (file này) + spec/plan liên quan.
2. Viết brief ngắn cho module theo mẫu §10.2, gửi về session gốc.
3. Chốt phạm vi, data model, API, UI, test, rủi ro.
4. Tạo design doc `docs/superpowers/specs/YYYY-MM-DD-<module>-design.md`.
5. Tạo plan `docs/superpowers/plans/YYYY-MM-DD-<module>.md`.
6. Triển khai theo TDD, PR nhỏ, cập nhật `PROJECT.md` khi có quyết định mới.

### 10.2 Mẫu brief cho fork

```markdown
### Brief: <tên module>
- Mục tiêu người dùng:
- Trong phạm vi:
- Ngoài phạm vi:
- Data model thay đổi:
- API/backend cần:
- Màn hình/component:
- Luồng chính:
- Test bắt buộc:
- Rủi ro:
- Câu hỏi cần chốt:
```

### 10.3 Nhánh, commit, PR

- Nhánh: `feat/<module>`, `fix/<bug>`, `docs/<topic>`.
- Commit nhỏ, message rõ: `feat: add tables floor plan`, `fix: scope receipt print CSS`.
- PR phải có: mục tiêu, phạm vi, ảnh nếu UI, test đã chạy, rủi ro, checklist.
- Không merge khi test/lint/build đỏ.
- Không trộn refactor hạ tầng với feature trong cùng PR.

### 10.4 Definition of Done cho module mới

- [ ] Có spec/plan được chốt.
- [ ] Data model + migration (nếu có) rõ.
- [ ] API/service interface rõ; không gọi localStorage trực tiếp từ component.
- [ ] Unit test cho logic/validation.
- [ ] Component test cho luồng chính.
- [ ] E2E smoke nếu là luồng vận hành.
- [ ] Empty/loading/error states; không fake số liệu.
- [ ] Responsive 1440/1280/1024/390; touch ≥44px nếu có tương tác.
- [ ] Accessibility: label, focus, Esc, aria-live.
- [ ] Không regression POS: full test pass.
- [ ] Cập nhật `PROJECT.md`, README, screenshot.
- [ ] Không có secret/token trong repo.

### 10.5 Checklist review nhanh

- [ ] Có thay đổi công thức tiền/VAT không? Nếu có, test có cập nhật?
- [ ] Có đụng snapshot hoá đơn không?
- [ ] Có đổi key/version persist không? Migration đâu?
- [ ] Có thêm dữ liệu giả/số liệu giả không?
- [ ] Có làm hỏng in 80mm không?
- [ ] Có làm hỏng layout 1024/390 không?
- [ ] Có thêm dependency nặng không? Vì sao?
- [ ] Có error boundary/empty state chưa?
- [ ] Có test cho failure case chưa?
- [ ] Tài liệu có được cập nhật chưa?

### 10.6 Khi nào cập nhật tài liệu này

- Thêm/bớt module hoặc đổi thứ tự roadmap.
- Đổi data model/API contract.
- Đổi quyết định trong bảng ADR.
- Thêm giới hạn vận hành mới.
- Thay đổi quy trình test/release.
- Thay ảnh stock bằng ảnh thật, đổi brand/thuế.

---

## 11. QA playbook

### 11.1 Lệnh tự động

```bash
npm test
npm run lint
npm run build
npm run preview
```

### 11.2 Kiểm tra giao diện

| Kích thước | Cần kiểm tra |
| --- | --- |
| 1440×900 | 4 cột menu, panel đơn 360px, không tràn |
| 1280×800 | 3 cột menu, sidebar đầy đủ, giá không wrap |
| 1024×768 | Sidebar thu gọn, panel đơn 320px, 3 cột |
| 390×844 | Menu 2 cột, drawer giỏ, thanh đáy, không tràn ngang |
| 768×1024 touch | Nút thêm/stepper/xoá/danh mục ≥44×44px |

### 11.3 Luồng smoke

1. Thêm 2 món khác nhau, tăng/giảm số lượng.
2. Chọn bàn, nhập ghi chú, giảm giá 10%.
3. Thanh toán tiền mặt thiếu → bị chặn; đủ → tạo đơn.
4. Mở hoá đơn, in PDF 80mm → 1 trang.
5. Reload → đơn nháp/lịch sử còn.
6. Lưu nháp → mở lại → đúng món/bàn/ghi chú.
7. Tìm kiếm toàn cục theo tên món/mã đơn.
8. PWA: build + preview, cài, tắt mạng, mở lại.
9. Dữ liệu hỏng: set localStorage sai shape → reload không trắng màn hình.
10. Storage lỗi: chặn `setItem` → banner cảnh báo hiện.

### 11.4 Kiểm tra in

- Mở DevTools → Print → chọn PDF, khổ 80mm, lề 4mm, scale 100%.
- Kiểm tra: 1 trang, không cắt tên món/ghi chú, tổng tiền đúng, thông tin quán đúng.
- Kiểm tra in lại từ trang Đơn hàng.

### 11.5 Kiểm tra PWA

- `npm run build && npm run preview`, mở `localhost`.
- Application → Manifest: tên/icon/theme đúng.
- Application → Service Workers: activated.
- Network → Offline → reload → app vẫn mở, bán được.
- Cập nhật bản mới: build lại, reload, kiểm tra autoUpdate.

---

## 12. Câu hỏi mở cần chốt trước khi mở rộng

1. **Backend stack** nào? (Node/NestJS, Laravel, Supabase, Firebase…)
2. **Mô hình triển khai:** một quán một server, hay SaaS nhiều quán?
3. **Auth:** tài khoản nhân viên dùng email/PIN hay SSO? Có cần offline login?
4. **Đồng bộ:** realtime bắt buộc hay chấp nhận polling 5–10 giây?
5. **Phạm vi Bàn:** chỉ sơ đồ + trạng thái, hay cần gộp/tách/chuyển bàn ngay?
6. **Đặt bàn:** có cần khách tự đặt online không, hay lễ tân nhập?
7. **Thanh toán:** có cần QR ngân hàng/VietQR, máy quẹt thẻ, hay chỉ ghi nhận?
8. **Máy in:** mẫu máy nào? ESC/POS qua USB/LAN/Bluetooth?
9. **Báo cáo:** chỉ doanh thu hay cần giá vốn/lợi nhuận/ kho?
10. **Đa ngôn ngữ:** chỉ tiếng Việt hay cần thêm?
11. **Dữ liệu khách:** có cần tuân thủ quyền riêng tư/xoá dữ liệu?
12. **Sao lưu:** local, cloud hay cả hai?

> Các câu hỏi này nên được chốt tại session gốc trước khi fork nhận brief.

---

## 13. Nhật ký dự án

| Ngày | Mốc |
| --- | --- |
| 2026-11-18 | Chốt thiết kế frontend, bắt đầu plan 11 task |
| 2026-11-18 | Hoàn thành scaffold, domain, store, UI, POS, thanh toán, in |
| 2026-11-19 | Hoàn thành đơn nháp, tìm kiếm, lịch sử, PWA, responsive |
| 2026-11-19 | Review độc lập; sửa PWA config, persist hỏng, cảnh báo lưu trữ, touch target |
| 2026-11-19 | 113/113 test, lint/build pass; mở PR #1 |
| 2026-11-19 | Viết `PROJECT.md` làm tài liệu gốc cho các fork |

---

## Phụ lục A — Thuật ngữ

| Thuật ngữ | Nghĩa |
| --- | --- |
| POS | Point of Sale — màn hình bán hàng tại quầy |
| Snapshot | Bản sao dữ liệu tại thời điểm thanh toán |
| Draft | Đơn nháp, lưu lại để mở sau |
| Outbox | Hàng đợi thao tác local chờ đồng bộ lên server |
| PWA | Progressive Web App |
| ESC/POS | Chuẩn lệnh máy in hoá đơn |
| ADR | Architecture Decision Record |
| RLS | Row-Level Security (nếu dùng Postgres/Supabase) |

## Phụ lục B — Liên kết

- [README](README.md) — chạy, build, deploy, cấu hình.
- [Thiết kế frontend](docs/superpowers/specs/2026-11-18-restaurant-pos-frontend-design.md)
- [Plan triển khai frontend](docs/superpowers/plans/2026-11-18-restaurant-pos-frontend.md)
- [Spec backend Phase 1](docs/superpowers/specs/2026-11-19-backend-foundation-spec.md)
- [Plan backend Phase 1](docs/superpowers/plans/2026-11-19-backend-foundation-plan.md)
- [Ảnh desktop](docs/screenshots/pos-desktop.jpg)
- [Ảnh 1024×768](docs/screenshots/pos-1024.jpg)
- [Ảnh mobile](docs/screenshots/pos-mobile.jpg)
- [Nguồn ảnh món](src/assets/menu/CREDITS.md)
- [PR #1](https://github.com/datnguyentien1910/POS-Food-and-Drink/pull/1)

---

## Phụ lục C — Ghi chú cho người viết tiếp

- Nếu bạn đang đọc file này để bắt đầu một fork: **đừng đọc toàn bộ `src/` trước**. Đọc §0, §3, §4, §5, §6, §10; sau đó mở đúng file trong bảng §0.4.
- Nếu bạn định thêm một trang mới: xem `APP_PAGES` trong `src/config.ts`, `PlaceholderPage`, và cách `App.tsx` chọn trang. Hiện chưa có router; hãy thêm router trước khi có từ 3 trang thật trở lên.
- Nếu bạn định thêm dữ liệu mới: đừng nhét vào `usePOSStore` nếu đó là dữ liệu dùng chung giữa các module. Tạo domain type + service + store riêng.
- Nếu bạn định sửa công thức tiền: viết test trước, cập nhật `calc.test.ts`, kiểm tra lại hoá đơn đã lưu (snapshot) không bị ảnh hưởng.
- Nếu bạn định sửa CSS in: kiểm tra lại PDF 80mm 1 trang, tên món dài, ghi chú dài, in lại từ lịch sử.
- Nếu bạn định đổi persist key/version: viết migration, test dữ liệu cũ, và giữ backup.
- Nếu bạn định thêm số liệu lên dashboard: chỉ dùng dữ liệu thật; nếu chưa có, hiện “—” hoặc empty state.
