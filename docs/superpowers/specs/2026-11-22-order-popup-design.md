# Thiết kế popup đơn hàng POS dùng chung

- **Ngày:** 2026-11-22
- **Nhánh:** `feat/order-popup`
- **Trạng thái:** đã được phê duyệt trong hội thoại

## 1. Ý định

Panel phải của POS hiện vừa sửa món, vừa ghi chú, giảm giá, vừa thanh toán. Người dùng muốn panel chỉ quản lý món và tiền, còn toàn bộ vòng đời đơn được gom vào **một popup dùng chung** ở POS, Bàn và Orders. Đơn có thể thanh toán ngay hoặc **chờ thanh toán** — đây là đơn thật, không phải đơn nháp.

## 2. Mục tiêu

- Panel phải: chỉ dòng món (thêm/xoá/sửa số lượng) + giá + nút **Tạo đơn**.
- Popup `OrderModal`: chọn bàn hoặc mang đi, chỉnh số lượng, ghi chú, giảm giá, **Lưu chờ thanh toán**, **Thanh toán**, **Thêm món**, **Huỷ đơn**.
- Popup mở được từ POS (nút Tạo đơn), từ trang Bàn (bàn đang có đơn) và từ Orders (đơn chờ).
- Orders page hiển thị 3 trạng thái kinh doanh: **Chờ thanh toán = vàng (`gold`)**, **Đã huỷ = đỏ (`negative`)**, **Thành công = xanh lá (`positive`)**. Màu luôn kèm nhãn chữ.
- Bàn vẫn bận cho tới khi thu tiền hoặc huỷ đơn; trạng thái bàn được suy ra, không lưu cứng.

## 3. Không làm

- Không đưa trạng thái chờ thanh toán lên server; server vẫn chỉ nhận đơn đã thu tiền.
- Không đổi schema/migration/e2e server, không đồng bộ nhiều máy.
- Không kéo-thả/gộp/tách/chuyển bàn, không đặt bàn, không KDS.
- Không đổi brand RestoDash → Serva (task riêng cuối dự án).

## 4. Ràng buộc

- Giữ persist key `restodash-pos-v1`; nâng version **3 → 4**, có migration và test.
- `OrderRecord` thêm `status: 'pending_payment' | 'completed' | 'cancelled'`; giữ `syncState` riêng cho đồng bộ.
- `OrderLineSnapshot` thêm `served?: boolean` để giữ trạng thái đã mang ra khi lưu đơn chờ.
- Store thêm `editingPendingOrderId: string | null` (persisted): id đơn chờ đang được mở trên POS. Đơn này không được tính trùng trong danh sách/bàn trong lúc đang soạn.
- Giữ nguyên luật `served` (khoá sửa/xoá; thêm món trùng tạo dòng mới) và cảnh báo 2 bước khi thanh toán còn món chưa ra.
- Giao diện tiếng Việt, dùng token màu có sẵn (`gold`, `negative`, `positive`).
- Không thêm dependency runtime; không mock/fake data trong production code.

## 5. Luồng

```
POS                          ┌──────────────────────────────┐
lưới món + giá               │ OrderModal (dùng chung)      │
┌──────────┬──────────┐      │ • chọn bàn / Mang đi         │
│ món      │ Đơn hiện │      │ • + / − món, ghi chú, giảm giá│
│          │ tại      │──Tạo │ • [Lưu chờ thanh toán]       │
│          │ [Tạo đơn]│  đơn │ • [Thanh toán]  [Huỷ đơn]     │
└──────────┴──────────┘      │ • [Thêm món] → về POS         │
                             └──────────────────────────────┘
Bàn (đang có đơn) ──bấm bàn──┘
Orders (đơn chờ) ──bấm đơn───┘
```

- **Lưu chờ thanh toán**: upsert bản ghi `status: 'pending_payment'` vào `history`, giữ toàn bộ món/`served`/ghi chú/giảm giá/bàn; xoá giỏ active; bàn vẫn bận.
- **Thêm món**: `resumePendingOrder(id)` nạp dữ liệu đơn vào giỏ active, gán `editingPendingOrderId = id`, quay về POS. Bản ghi vẫn còn nhưng được coi là "đang soạn", không hiển thị trong danh sách chờ. Lưu lại thì cập nhật chính bản ghi đó.
- **Thanh toán**: `payPendingOrder(id, payment)` dùng lại `clientId` của đơn để đẩy queue, đổi status `completed`; bàn về trống. Cảnh báo món chưa ra vẫn áp dụng.
- **Huỷ đơn**: `cancelPendingOrder(id)` → `cancelled`; bàn về trống; nếu có queue item thì bỏ.
- **Từ trang Bàn**: bàn có đơn (🟡/🟢) → mở popup của đơn đó; bàn 🔴 → chọn bàn rồi vào POS.

## 6. Quyết định đã chốt trong hội thoại

| Quyết định | Lựa chọn |
| --- | --- |
| Nơi lưu đơn chờ | Local-only, trong `history`, không lên server |
| Bàn khi lưu chờ | Vẫn bận tới khi thu tiền/huỷ |
| Giỏ active sau khi lưu chờ | Xoá; nội dung nằm trong đơn chờ |
| Popup mở từ đâu | Cả POS và Bàn ( Orders dùng chế độ thanh toán ) |
| Cách làm | Mở rộng store POS hiện tại, một nguồn dữ liệu |

## 7. Tiêu chí nghiệm thu

- Migration v3 → v4 không mất cart/nháp/history/queue; dữ liệu cũ có status suy ra đúng.
- `openOrders` không chứa bàn active; resume đơn chờ không làm mất giỏ đang có.
- Món `served` giữ nguyên qua lưu chờ → thêm món → lưu lại → thanh toán.
- `editingPendingOrderId` không gây đếm trùng đơn trong Orders hoặc bàn.
- Thanh toán đơn chờ gửi đúng `tableId` UUID (nếu đã sync) hoặc bỏ qua (nếu chưa sync), giữ `tableName`.
- Badge Orders đúng 3 màu + nhãn; huỷ đơn trả bàn về trống.
- Root `npm test`, `npm run lint`, `npm run build` và server test/e2e vẫn pass.
