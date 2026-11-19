# RestoDash POS

Frontend POS cho nhà hàng/quán ăn: gọi món, giỏ hàng, giảm giá, thanh toán và in hoá đơn 80mm. Giao diện tiếng Việt, tiền tệ VND, tối ưu cho laptop tại quầy và tablet. Ứng dụng chạy hoàn toàn trên trình duyệt, lưu đơn nháp và lịch sử trên chính thiết bị, dùng được khi mất mạng sau lần tải đầu.

> Backend, đăng nhập và đồng bộ nhiều máy sẽ được bổ sung ở giai đoạn sau. Hiện tại POS và trang Đơn hàng là hai màn hình dùng thật; các mục còn lại là placeholder có chủ đích.

![POS desktop](docs/screenshots/pos-desktop.jpg)

## Tính năng

- **Gọi món**: 16 món mẫu, tabs danh mục, tìm kiếm không dấu, lọc món phổ biến, sắp xếp theo giá, tải thêm món.
- **Đơn hiện tại**: chọn bàn hoặc mang đi, tăng/giảm số lượng, ghi chú, giảm giá theo số tiền hoặc phần trăm, VAT 8%, lưu tạm.
- **Thanh toán**: tiền mặt (tính tiền thối, chặn thu thiếu), chuyển khoản, thẻ. Đơn hoàn tất được lưu vào lịch sử trên thiết bị.
- **Hoá đơn**: bản in 80mm qua hộp thoại in của trình duyệt; xem và in lại từ trang Đơn hàng hoặc tìm kiếm toàn cục.
- **Đơn nháp**: mở lại, xoá, cảnh báo trước khi thay thế đơn đang làm.
- **Tìm kiếm toàn cục**: `Ctrl/⌘ K` tìm món, đơn nháp, hoá đơn; điều hướng bằng bàn phím.
- **PWA**: cài như ứng dụng, precache tài nguyên, tự cập nhật khi có bản mới.
- **Responsive**: sidebar đầy đủ trên desktop, thu gọn ở 1024–1279px, drawer dưới 1024px; giỏ hàng là drawer + thanh tổng tiền cố định trên màn hình nhỏ.

## Chạy dự án

Yêu cầu Node.js `^20.19.0` hoặc `>=22.12.0` (điều kiện của Vite 8).

```bash
npm install
npm run dev
```

Mở `http://localhost:5173`. Để thử trên tablet trong cùng mạng LAN:

```bash
npm run dev -- --host
```

### Build và kiểm thử

```bash
npm test        # Vitest + Testing Library
npm run lint    # oxlint
npm run build   # type-check + build tĩnh vào dist/
npm run preview # chạy thử bản build
```

Deploy bằng cách phục vụ thư mục `dist/` trên hosting tĩnh bất kỳ. PWA cần `https://` hoặc `localhost`; service worker không chạy ở chế độ dev.

## Cấu hình

| Nội dung | Tệp |
| --- | --- |
| Tên quán, địa chỉ, điện thoại, email, thuế VAT, tên thu ngân | `src/config.ts` |
| Món, giá, danh mục, ảnh, nhãn phổ biến | `src/data/menu.ts` |
| Bàn và số chỗ | `src/data/tables.ts` |
| Ảnh món (WebP, khung 4:3) | `src/assets/menu/` |
| Màu sắc, font, hiệu ứng, CSS in | `src/index.css` |
| Manifest, icon, precache | `vite.config.ts`, `public/` |

Menu mặc định dùng `id` ổn định. Khi thêm món, giữ `id` duy nhất; đơn nháp và hoá đơn cũ tham chiếu món theo `id`, nên không nên đổi `id` của món đã bán. Giá món được đọc tại thời điểm tính tiền; hoá đơn đã lưu giữ giá tại lúc thanh toán.

Thuế mặc định `taxRate: 0.08` (8%) và được tính trên tạm tính sau giảm giá. Sửa trong `src/config.ts` nếu quán dùng mức khác.

## Dữ liệu lưu trên thiết bị

Store dùng Zustand persist với key:

```text
restodash-pos-v1
```

Bao gồm: giỏ hàng đang làm, bàn đang chọn, giảm giá, ghi chú, danh sách đơn nháp và lịch sử đơn đã thanh toán. Dữ liệu tồn tại qua reload và tắt/mở trình duyệt.

- **Xoá dữ liệu**: DevTools → Application → Local Storage → xoá key trên, hoặc chạy `localStorage.removeItem('restodash-pos-v1')` trong Console.
- **Sao lưu**: copy giá trị JSON của key để cất; khôi phục bằng `localStorage.setItem('restodash-pos-v1', '<json>')` rồi tải lại trang.
- **Một thiết bị, một tab**: chưa có đồng bộ giữa các tab/máy. Không nên mở nhiều tab POS cùng lúc vì thao tác ở tab sau có thể ghi đè dữ liệu của tab trước.

Dữ liệu nằm trong trình duyệt của máy đang dùng. Xoá dữ liệu trình duyệt, đổi profile hoặc dùng chế độ ẩn danh sẽ làm mất đơn nháp/lịch sử.

## In hoá đơn

1. Thanh toán xong, bấm **Xem hoá đơn** → **In hoá đơn**; hoặc vào **Đơn hàng** và chọn **Xem hoá đơn**.
2. Trong hộp thoại in, chọn máy in 80mm, khổ giấy 80mm, lề khoảng 4mm, tỉ lệ 100%.
3. Tắt headers/footers của trình duyệt. Có thể bật "Background graphics" nếu muốn giữ nền trắng/xám của bản in.
4. Chỉ nội dung `.print-area` được in; giao diện POS xung quanh bị ẩn bằng CSS.

Hiện tại app dùng hộp thoại in của trình duyệt, chưa gửi lệnh trực tiếp tới máy in ESC/POS. Chuyển khoản/thẻ mới ghi nhận phương thức thanh toán, chưa xác nhận giao dịch với ngân hàng.

## PWA và chế độ offline

```bash
npm run build
npm run preview
```

Mở bản preview bằng `localhost` (hoặc deploy HTTPS), sau đó dùng nút cài đặt trên thanh địa chỉ (Chrome/Edge) để cài RestoDash. Service worker precache HTML, JS, CSS, font, icon và ảnh món; sau lần tải đầu, app mở được khi mất mạng. Khi deploy bản mới, `autoUpdate` sẽ kích hoạt cập nhật và có thể cần tải lại trang một lần.

Dữ liệu bán hàng không phụ thuộc mạng. Tuy nhiên, lần đầu cài đặt và mọi bản cập nhật đều cần mạng.

## Ảnh món

Ảnh trong `src/assets/menu/` là ảnh stock miễn phí dùng cho menu mẫu, **không phải ảnh món thật của quán**. Nguồn và giấy phép ghi tại [`src/assets/menu/CREDITS.md`](src/assets/menu/CREDITS.md) (Unsplash License và Pexels License).

Khi dùng thật, thay từng tệp cùng tên bằng ảnh chụp món của quán: khung 4:3, nén WebP dưới khoảng 150KB để giữ thời gian tải nhanh.

## Cấu trúc chính

```text
src/
  assets/menu/        ảnh món + CREDITS.md
  components/         layout, menu, order, modals, receipt, search, stats, ui
  data/               menu.ts, tables.ts
  lib/                calc, format, search, id, menu-query, global-search
  pages/              POSPage, OrdersPage, PlaceholderPage
  store/              usePOSStore.ts
  config.ts           thông tin quán, tài khoản hiển thị, danh sách trang
  index.css           theme, animation, print CSS
docs/
  superpowers/        spec và plan triển khai
  screenshots/        ảnh giao diện
public/               favicon và icon PWA
```

## Giới hạn đã biết

- Chưa có backend, đăng nhập, phân quyền, đồng bộ nhiều thiết bị hay sao lưu tự động.
- Khách hàng và Công nợ hiển thị “—” cho tới khi nối backend; app không tạo số liệu giả.
- Chưa tích hợp máy in ESC/POS, QR ngân hàng hay máy quẹt thẻ.
- Các trang Tổng quan, Bàn, Đặt bàn, Thực đơn, Khách hàng, Báo cáo, Chi phí, Nhân viên, Cài đặt là placeholder.
- PWA cần HTTPS hoặc localhost. Safari/iPad có thể có khác biệt nhỏ về hộp thoại in và cách cài đặt.
- Chưa hỗ trợ nhiều tab/thiết bị cùng lúc; dữ liệu chỉ nằm trên trình duyệt hiện tại.
- Ảnh món là ảnh minh hoạ stock, cần thay bằng ảnh thật của quán.

## Kiểm thử

Bộ test hiện có 107 test cho logic tính tiền, store, tìm kiếm, các luồng giỏ hàng/thanh toán/đơn nháp và các component chính. Test chạy trên jsdom với viewport 1440×900; kiểm tra giao diện thật được thực hiện thêm bằng trình duyệt ở các kích thước 1440×900, 1280×800, 1024×768 và 390×844. Ảnh tham chiếu: [desktop](docs/screenshots/pos-desktop.jpg), [1024×768](docs/screenshots/pos-1024.jpg), [mobile](docs/screenshots/pos-mobile.jpg).

Thiết kế tham chiếu: [Restaurant POS Dashboard UI Design](https://dribbble.com/shots/27321876-Restaurant-POS-Dashboard-UI-Design) của Rexnor studio. Font Plus Jakarta Sans, icon Lucide.
