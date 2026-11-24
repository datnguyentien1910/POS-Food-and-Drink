# Chỉnh giao diện popup đơn hàng POS

- **Ngày:** 2026-11-22
- **Nhánh:** `feat/order-popup` (tiếp nối module popup đơn hàng)
- **Trạng thái:** đã chốt trong hội thoại

## 1. Ý định

Popup thanh toán hiện dùng `size="md"` (~448px) nên chật. Người dùng muốn phóng to popup và dồn toàn bộ thao tác chọn bàn, tick món đã mang ra vào trong popup; panel bên phải chỉ còn quản lý món và tổng tiền.

## 2. Mục tiêu

- `Modal` có thêm size `xl` (`max-w-5xl`, ~1024px). `OrderModal` dùng size này, desktop bố cục **2 cột**: trái chọn bàn + danh sách món; phải ghi chú/giảm giá/tổng/phương thức thanh toán/nút. Mobile co về 1 cột.
- Panel phải (`OrderPanel`) **bỏ**: `TableBadge`, nút tick "Mang ra/Đã ra" trên từng dòng, nút "Chọn tất cả". Giữ: dòng món, số món, tổng tiền, **Tạo đơn**, lưu tạm, xoá đơn.
- Popup có đủ:
  - Chọn bàn / Mang đi ở **cả hai chế độ** tạo mới và đơn chờ.
  - Tick từng món "Mang ra"/"Đã ra" + "Chọn tất cả".
  - Ở chế độ tạo: stepper số lượng + xoá món như `CartRow` hiện tại.
  - Ở chế độ đơn chờ: giữ số lượng read-only (dùng "Thêm món" để sửa ở POS), nhưng vẫn tick served và đổi bàn được.
- Đổi bàn trong đơn chờ: cập nhật `tableId`/`tableName` của chính bản ghi đó; bàn cũ hết bận, bàn mới bận. Chặn chọn bàn đang có đơn mở khác (dùng `isTableBusy`, loại trừ chính đơn đang mở).

## 3. Không làm

- Không đổi server, không đổi luật `served` (món đã ra vẫn khoá sửa/xoá), không đổi cảnh báo thanh toán 2 bước.
- Không đổi persist key/version (`restodash-pos-v1`, v4).
- Không thêm dependency runtime; không đổi brand.

## 4. Ràng buộc

- Popup mở từ Bàn/Orders vẫn **không** tự resume đơn chờ; chỉ nút "Thêm món" mới resume.
- `OrderRecord.status` giữ nguyên 3 trạng thái; badge Orders không đổi.
- `tableServingState` vẫn suy ra từ giỏ active/`openOrders`/đơn chờ.
- UI tiếng Việt; màu đi kèm nhãn chữ; responsive mobile.

## 5. Nguyên tắc thiết kế

- `ModalSize` thêm `'xl'`; các size cũ giữ nguyên.
- Store thêm action vá bản ghi chờ mà **không resume**:
  - `setPendingOrderTable(orderId, tableId: string | null): void`
  - `setPendingLineServed(orderId, lineId, served: boolean): void`
  - `setAllPendingServed(orderId): void`
- Các action này cập nhật `history` record tương ứng (giữ `clientId`, không tạo bản ghi mới), cập nhật `tableName` qua `resolveTableName`, và không đụng giỏ active hay `editingPendingOrderId`.
- Popup chế độ tạo dùng `setLineServed`/`setAllServed` hiện có trên giỏ active.

## 6. Tiêu chí nghiệm thu

- Popup đạt ~1024px trên desktop, 2 cột rõ ràng; mobile không tràn ngang.
- Panel phải không còn text/button "Chọn bàn", "Mang ra", "Đã ra", "Chọn tất cả".
- Chọn bàn từ popup của đơn chờ đổi đúng bàn của đơn đó; bàn cũ hết bận.
- Tick served trong popup cập nhật đúng giỏ active (tạo) hoặc đúng bản ghi chờ (pending), và bàn đổi 🟡/🟢 tương ứng.
- Full test/lint/build vẫn pass; server không đổi.
