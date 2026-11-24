# Cho phép giảm/xoá món trong popup đơn chờ

- **Ngày:** 2026-11-22
- **Nhánh:** `feat/order-popup`

## Ý định

Popup "Chi tiết đơn chờ" từ module Bàn hiện chỉ cho tick served, còn số lượng ghi cố định với chú thích dùng "Thêm món" để sửa. Người dùng muốn giảm/xoá ngay các món chưa ra trong popup.

## Mục tiêu

- Dùng lại `CartRow` cho danh sách món ở chế độ đơn chờ: stepper `− / +`, nút xoá, nút "Mang ra / Đã ra".
- Món `served === true` vẫn bị khoá giảm/xoá (chính sách A); chỉ tick served.
- Tổng tiền và tiền thu trong popup cập nhật theo món vừa sửa.
- Nếu đơn đang được soạn (`editingPendingOrderId === orderId`), thay đổi phải đồng bộ vào giỏ active để lúc save-before-pay không bị ghi đè.

## Không làm

- Không đổi persist key/version, server, luật cảnh báo 2 bước, badge trạng thái.
- Không cho sửa món đã ra.

## Ràng buộc

- `OrderLineSnapshot.served` giữ nguyên; `lineId = ${order.id}:${index}`.
- Tính lại `subtotal/discountAmount/tax/total` bằng `calcTotals` với `order.discount` (fallback `discountAmount`).
- Không thêm dependency, không mock/fake data production, UI tiếng Việt.
