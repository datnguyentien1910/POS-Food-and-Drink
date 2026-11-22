# Design: Món phổ biến lên đầu trong POS

- **Ngày:** 2026-11-22
- **Phạm vi:** nhỏ — 1 hàm + test

## Ý định
Trên màn hình POS, món được tick **Phổ biến** ("Bán chạy" ở trang quản lý) phải nổi lên đầu để thu ngân thao tác nhanh hơn. Người dùng đã xác nhận: giữ nhãn `Mặc định`, áp dụng cho tab **Tất cả** và mọi tab nhóm, không áp dụng cho sắp xếp theo giá.

## Hành vi
- Kiểu sắp `default`: món `popular: true` đứng trước; thứ tự tương đối giữ nguyên như catalog (sort ổn định).
- Vì bộ lọc category/search chạy trước khi sort, hành vi này tự đúng ở mọi tab.
- `price-asc` / `price-desc`: giữ nguyên, không ghìm món phổ biến.
- Không đổi nhãn select, không thêm option, không đổi UI.

## Cách làm (đã chọn)
- Sửa `queryMenu` trong `src/lib/menu-query.ts`, thêm nhánh sort cho `default`.
- Test trong `src/lib/menu-query.test.ts`: phổ biến lên đầu ở `all`, lên đầu trong 1 nhóm, và sort giá không bị ảnh hưởng.
- Không đụng store/server/seed, không thêm dependency.

## Phương án đã cân nhắc
- **A (chọn):** sửa riêng `queryMenu` — nhỏ nhất, đúng phạm vi POS.
- **B:** thêm option "Bán chạy trước" — dư thừa, vì đã có ô "Mặc định" và bộ lọc "Chỉ món phổ biến".
- **C:** sắp trong `mapMenuItems` — ảnh hưởng mọi nơi dùng catalog, vượt phạm vi POS.
