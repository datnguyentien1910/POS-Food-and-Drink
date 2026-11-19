# RestoDash POS — Thiết kế frontend

Ngày: 2026-11-18
Trạng thái: đã duyệt — triển khai v1 hoàn thành (19/11/2026)
Tham chiếu: https://dribbble.com/shots/27321876-Restaurant-POS-Dashboard-UI-Design (Rexnor studio)

> **Lưu ý lịch sử:** đây là thiết kế ban đầu. Một số tên trường đã đổi khi triển khai (`currentTable` → `tableId`, `orderNote` → `note`, `table` → `tableName`, `paidAt` → `createdAt`). Nguồn sự thật hiện tại là [`PROJECT.md`](../../../PROJECT.md) §4.4 và `src/types.ts`. Manifest PWA hiện hardcode trong `vite.config.ts`, không đọc từ `src/config.ts`.

## 1. Mục tiêu và bối cảnh

Xây frontend POS cho một quán ăn/nhà hàng, **dùng thật tại quầy**, backend để giai đoạn sau. Giao diện bám sát shot tham chiếu: bố cục ba vùng, tông trắng – tím nhạt, card bo tròn, typography gọn, cảm giác SaaS premium.

Người dùng chính: nhân viên order/thu ngân, thao tác nhanh trên desktop hoặc tablet cảm ứng. Vì vậy ưu tiên tốc độ thao tác, nút bấm lớn, phản hồi rõ ràng và không để mất đơn khi reload.

Tiêu chí thành công:

- Thêm món → chỉnh giỏ → thanh toán trong vài giây, không cần chuột phải.
- Reload/tắt trình duyệt không mất đơn đang làm và đơn nháp.
- Giao diện chỉn chu ở 1440px, 1280px và tablet ngang 1024px, không có trạng thái “nửa vời”.
- Thay menu, tên quán, thuế, số bàn bằng sửa file cấu hình/dữ liệu, không đụng component.

## 2. Phạm vi

### Trong phạm vi

- Một màn hình POS hoàn chỉnh: sidebar, topbar, 4 thẻ số liệu, khu menu, panel đơn hiện tại.
- Tìm kiếm món (có bỏ dấu tiếng Việt), lọc theo danh mục, sắp xếp giá.
- Tìm kiếm nhanh toàn cục ở topbar: món, đơn nháp, đơn đã thanh toán; chọn kết quả để thêm món / mở nháp / xem hoá đơn.
- Trang **Đơn hàng** dùng lịch sử local: lọc hôm nay/tất cả, xem chi tiết và in lại hoá đơn. Các mục sidebar còn lại vẫn là placeholder.
- PWA precache (vite-plugin-pwa, autoUpdate) để mở lại app khi mất mạng sau lần tải đầu.
- Giỏ hàng: thêm, tăng/giảm, xoá, ghi chú đơn, chọn bàn hoặc mang đi.
- Giảm giá (số tiền hoặc %), VAT 8% cấu hình được, tổng tiền VND.
- Thanh toán: modal chọn tiền mặt/chuyển khoản/thẻ; tiền mặt có nhập tiền khách đưa, gợi ý mệnh giá, tính tiền thừa; xác nhận lưu đơn vào lịch sử local.
- Lưu tạm đơn nháp, mở lại, xoá nháp; badge số đơn nháp.
- Hoá đơn sau thanh toán, in qua hộp thoại in của trình duyệt (khổ 80mm).
- Thông báo toast, phím tắt Ctrl/⌘+K, trạng thái rỗng, xác nhận trước hành động phá huỷ.
- Sidebar đủ 11 mục như shot; POS và Đơn hàng có trang thật, các mục còn lại mở trang placeholder được thiết kế chỉn chu, không phải link chết.
- Responsive: desktop 3 cột; tablet sidebar thu gọn/drawer, giỏ hàng thành drawer với thanh tổng tiền cố định; mobile xem được menu và giỏ.
- Mock data 16 món, ảnh local dạng WebP (không phụ thuộc internet). Ảnh lấy từ stock miễn phí (Unsplash/Pexels), ghi nguồn trong README, không dùng lại ảnh của shot Dribbble; chủ quán thay bằng ảnh món thật sau.

### Ngoài phạm vi

- Backend, API, tài khoản đăng nhập thật, phân quyền.
- Đồng bộ nhiều máy, quản lý kho, báo cáo doanh thu thật, đặt bàn, quản lý khách hàng.
- Thanh toán điện tử thật (QR ngân hàng, máy POS vật lý), tích hợp máy in ESC/POS.
- Đa ngôn ngữ; bản mobile dành cho khách tự đặt món.

### Anti-goals

- Không dùng UI kit đóng sẵn khiến giao diện giống template; component tự viết bằng Tailwind.
- Không hiển thị số liệu giả trông như thật ở nơi gây hiểu nhầm vận hành (doanh thu, công nợ).
- Không thêm tính năng ngoài phạm vi chỉ để “trông đầy đủ”.

## 3. Quyết định đã chốt

- **Hướng A — React + Vite + TypeScript + Tailwind CSS v4**, SPA build tĩnh. Đã chọn thay vì Next.js (SSR không cần cho POS nội bộ, deploy nặng) và HTML/JS thuần (khó bảo trì khi dùng thật).
- State: **Zustand** + `persist` (localStorage), tách lớp `store` khỏi UI để sau này thay bằng API.
- Icon: **lucide-react**. Font: **Plus Jakarta Sans** self-host qua @fontsource (chạy offline).
- Component tự viết, không dùng shadcn/UI kit.
- Ngôn ngữ giao diện: **tiếng Việt**; tiền tệ **VND**, format `vi-VN`, không phần thập phân.
- Brand mặc định “RestoDash — POS System”, đổi được qua `src/config.ts`.
- Ảnh món tải sẵn vào `src/assets/menu/`, nén WebP, khung hiển thị 4:3. Nguồn: ảnh stock miễn phí cùng món, nền sạch; ghi link nguồn trong README.
- Animation bằng CSS thuần (thực tế 150–300ms), không thêm thư viện motion.
- PWA precache bằng `vite-plugin-pwa` chế độ autoUpdate; app chạy như web tĩnh (localhost/LAN hoặc hosting tĩnh). Backend sau này sẽ thay lớp service.
- Trình duyệt mục tiêu chính: Chrome/Edge trên desktop; responsive kiểm tra cho tablet. Safari/iPad dùng được ở mức cơ bản, ghi chú lại nếu có khác biệt.

## 4. Giao diện

### Bố cục và token

- Nền `#F9F8FA`; card trắng, viền `#ECE8F1`, bo 16px, shadow mềm.
- Primary `#241EB2` (tím indigo đậm), primary-soft `#EEECFF`; chữ chính `#1C1514`, chữ phụ `#7A7370`.
- Tích cực `#668E77`, cảnh báo/giảm `#BA5118`, vàng nhấn `#D8A047`, nâu phụ `#58453B`.
- Sidebar 268px, topbar 80px, panel đơn ~340px; main co giãn.
- Font Plus Jakarta Sans: tiêu đề 20/600, số liệu 22/700, body 14/500, phụ 12/500.
- Focus ring rõ ràng, vùng chạm tối thiểu 44px trên tablet.

### Thành phần

- **Sidebar**: logo tile gradient + brand; nav 11 mục (Tổng quan, POS, Đơn hàng, Bàn, Đặt bàn, Thực đơn, Khách hàng, Báo cáo, Chi phí, Nhân viên, Cài đặt) với pill active; card “Mẹo nhanh” thay cho card quảng cáo Upgrade (giữ bố cục, có ích khi dùng thật); khối hỗ trợ lấy từ config.
- **Topbar**: nút thu gọn/mở sidebar; ô tìm kiếm toàn cục “Tìm món, đơn nháp, đơn đã thanh toán…” với dropdown kết quả nhóm theo loại, điều hướng bằng phím, gợi ý Ctrl K; chuông thông báo kèm dropdown 3 thông báo mẫu và đánh dấu đã đọc; ngày giờ chạy realtime; chip người dùng (ảnh, tên, vai trò) có dropdown.
- **Thẻ số liệu**: Doanh thu hôm nay và Đơn hôm nay tính từ lịch sử local; Khách và Công nợ hiển thị “—” kèm chú thích “sẽ có khi nối backend” (không bịa số). Delta hiển thị khi có dữ liệu so sánh hôm qua.
- **Khu menu**: tabs Tất cả / Phổ biến / Đồ uống / Khai vị / Món chính / Tráng miệng; toolbar gồm tìm kiếm món và select sắp xếp (Mặc định, Giá tăng, Giá giảm); nút “Bộ lọc” mở popover (chỉ món phổ biến, đặt lại). Grid 4 cột ở ≥1280px, 3 cột ở 1024–1279, 2 cột dưới 768. Card món: ảnh bo 12px, tên, giá, nút “+”. Hover nhấc nhẹ; bấm thêm có phản hồi và badge nhảy. “Xem thêm” hiển thị 12 món đầu, bấm tải phần còn lại.
- **Panel đơn hiện tại**: tiêu đề + badge bàn (mở bảng chọn Bàn 1–12 hoặc Mang đi) + menu “…” (xoá đơn, mở đơn nháp); danh sách dòng món (ảnh, tên, giá, stepper, nút xoá); ghi chú đơn; dòng tạm tính, giảm giá (bấm để sửa), VAT 8%, tổng; nút **Thanh toán {tổng}** và **Lưu tạm**. Trạng thái giỏ rỗng có minh hoạ + hướng dẫn.
- **Modal**: dùng phần tử `<dialog>` native (focus trap, Esc sẵn), gồm Thanh toán, Chọn bàn, Giảm giá, Đơn nháp, Hoá đơn, Xác nhận xoá. Backdrop mờ nhẹ, chuyển động fade/scale.
- **Toast** góc trên phải, tự tắt sau 3 giây, `aria-live="polite"`.

### Responsive

- ≥1280px: ba cột như shot.
- 1024–1279px: sidebar thu gọn còn icon (84px, hover hiện tooltip), panel đơn 320px, grid 3 cột.
- 768–1023px: sidebar thành drawer (nút hamburger), panel đơn thành drawer phải mở bằng thanh tổng tiền cố định dưới đáy; grid 2–3 cột.
- <768px: topbar gọn, grid 2 cột, drawer giỏ toàn màn hình; vẫn thao tác đủ.

## 5. Hành vi và dữ liệu

### Store (persist key `restodash-pos-v1`)

- `cart`: dòng món `{ lineId, menuItemId, qty }`.
- `currentTable`: `{ id, name } | null` (mặc định “Chọn bàn”).
- `discount`: `{ type: 'amount' | 'percent', value }`.
- `orderNote`: string.
- `drafts`: danh sách `{ id, table, items, discount, note, createdAt }`.
- `history`: đơn đã thanh toán `{ id, code, table, items snapshot (tên, giá, qty), subtotal, discount, tax, total, method, received?, change?, paidAt, cashier }`.
- UI state (modal, drawer, search) giữ trong React local, không persist.

### Tính tiền

`subtotal = Σ giá × số lượng` → `discountAmount` (amount hoặc % subtotal, không vượt subtotal) → `tax = round((subtotal − discount) × 8%)` → `total = subtotal − discount + tax`. Tất cả VND số nguyên. Công thức nằm trong `lib/calc.ts` có unit test.

### Luồng chính

1. **Thêm món**: bấm card hoặc nút “+”; nếu món đã có thì tăng số lượng; toast ngắn “Đã thêm …”; badge giỏ cập nhật.
2. **Chọn bàn**: mở modal chọn bàn/mang đi; badge hiển thị lựa chọn.
3. **Giảm giá**: modal nhập số tiền hoặc %, preview tổng ngay; cho phép xoá giảm giá.
4. **Lưu tạm**: lưu nguyên đơn vào drafts, làm trống đơn hiện tại; mở lại thì nạp lại và xoá khỏi drafts; xoá nháp cần xác nhận.
5. **Thanh toán**: modal hiển thị tổng; chọn phương thức.
   - Tiền mặt: nhập tiền khách đưa, chip gợi ý (đủ tiền, 100k, 200k, 500k), hiện tiền thừa; không cho xác nhận khi thiếu.
   - Chuyển khoản/thẻ: ghi nhận phương thức, không xử lý giao dịch thật.
   - Xác nhận → tạo mã `HD-YYYYMMDD-XXX`, lưu history, xoá giỏ hiện tại, hiện màn hình thành công với nút In hoá đơn / Đơn mới.
6. **In**: mở modal hoá đơn khổ 80mm, thông tin quán từ config, dùng `window.print()` và CSS `@media print`.
7. **Tìm kiếm**: ô trong khu menu lọc món ngay khi gõ, chuẩn hoá bỏ dấu. Ô topbar tìm toàn cục qua món + đơn nháp + lịch sử đã thanh toán; kết quả nhóm theo loại, ↑/↓ để chọn, Enter để hành động (thêm món vào giỏ / mở đơn nháp / mở hoá đơn), Esc đóng. Ctrl/⌘+K focus ô topbar; gõ trong ô menu không tranh chấp phím tắt.
8. **Đơn hàng**: trang lịch sử local, lọc Hôm nay / Tất cả, tìm theo mã hoặc bàn, mở chi tiết và in lại hoá đơn; đơn mới nhất lên đầu.
9. **Sidebar**: POS và Đơn hàng là trang thật; các mục khác mở trang placeholder “Tính năng đang hoàn thiện cùng backend” với minh hoạ và nút quay lại POS.

### Nội dung mẫu

- 16 món Việt hoá tên gần với shot (Gà nướng, Burger bò, Pizza Margherita, Salad Caesar, Khoai tây chiên, Mì Ý gà, Bánh chocolate, Nước chanh, Cà phê nóng, Bánh mì rau, Bánh mì bơ tỏi, Kem, Trà đào, Sinh tố xoài, Gỏi cuốn, Chè).
- Giá VND thực tế cho quán cà phê/nhà hàng (25.000–129.000₫). Toàn bộ nằm trong `src/data/menu.ts`, ảnh đặt tên theo `id`.

## 6. Kiến trúc mã nguồn

```
src/
  main.tsx, App.tsx, index.css
  config.ts                  # brand, địa chỉ, VAT, số bàn, footer hoá đơn, cashier
  types.ts
  data/menu.ts, data/tables.ts
  store/usePOSStore.ts
  lib/format.ts, calc.ts, search.ts, id.ts
  components/ui/             # Button, IconButton, Modal, Popover, Toast, Stepper, Badge, EmptyState
  components/layout/         # Sidebar, TopBar, AppShell
  components/search/GlobalSearch.tsx
  components/stats/StatsCards.tsx
  components/menu/           # MenuPanel, CategoryTabs, MenuCard, MenuGrid
  components/order/          # OrderPanel, CartRow, OrderSummary, TableBadge
  components/modals/         # ChargeModal, TableModal, DiscountModal, DraftsModal, ReceiptModal, ConfirmModal
  pages/POSPage.tsx, OrdersPage.tsx, PlaceholderPage.tsx
docs/…
```

- PWA cấu hình trong `vite.config.ts`; manifest dùng tên/token từ config, theme color primary.

- Không dùng router ở v1; chuyển trang bằng state để đơn giản, cấu trúc page tách sẵn cho router sau này.
- Tailwind v4 qua plugin Vite, token khai báo trong `@theme` của `index.css`.
- Ảnh import qua Vite để có hash và tối ưu cache; `loading="lazy"` cho lưới.

## 7. Kiểm thử và xác minh

- Unit test (Vitest): tính subtotal/discount/tax/total, format VND, chuẩn hoá tìm kiếm, logic gộp kết quả tìm kiếm toàn cục, reducer store (thêm/tăng/xoá/lưu nháp/thanh toán), mã đơn.
- Component test nhẹ (React Testing Library) cho luồng thêm món và thanh toán nếu thời gian cho phép.
- Kiểm tra thủ công bằng trình duyệt ở 1440×900, 1280×800, 1024×768, 390×844; so sánh trực quan với shot.
- `npm run build` và `npm run lint` phải qua trước khi bàn giao; README hướng dẫn chạy, đổi menu/cấu hình.

## 8. Rủi ro và lưu ý

- localStorage mất khi xoá dữ liệu trình duyệt hoặc đổi máy; đây là giới hạn đã biết khi chưa có backend, cần ghi rõ trong README.
- PWA có thể giữ bản cũ trong cache; dùng autoUpdate và ghi chú cách hard-refresh khi cập nhật. Service worker chỉ chạy khi phục vụ qua http(s), không chạy với `file://`.
- Dùng chung một máy tính tại quầy là mô hình chính; chưa có auth và phân quyền.
- In hoá đơn phụ thuộc hộp thoại in và máy in của hệ điều hành, chưa phải ESC/POS.
- Ảnh WebP nén mỗi ảnh dưới ~150KB để trang tải nhanh.
- Múi giờ hiển thị theo máy; mã đơn theo ngày local.

## 9. Định nghĩa hoàn thành

- Giao diện đạt độ bám sát cao với shot ở desktop; mọi phần tử nhìn thấy đều hoạt động hoặc có chủ đích rõ ràng.
- Các luồng thêm món, sửa giỏ, giảm giá, lưu nháp, thanh toán, in và in lại từ trang Đơn hàng hoạt động trơn tru; dữ liệu sống qua reload.
- Không còn text tiếng Anh thừa, không số liệu giả gây hiểu nhầm, không nút chết.
- Responsive tốt ở các kích thước nêu trên, bàn phím và screen reader dùng được ở mức cơ bản.
- Test, lint, build đều qua; README đầy đủ.

## 10. Phần để người triển khai tự quyết

- Khoảng cách, kích thước chính xác của từng component; nội dung copy phụ.
- Chi tiết animation, thứ tự xuất hiện của hiệu ứng.
- Cách trình bày hoá đơn 80mm trong CSS in.
- Danh sách 16 món và giá cụ thể (miễn hợp lý và dễ thay).
- Cách bố trí trang placeholder cho các mục sidebar.
