# Báo cáo hoàn tất module Bàn

- **Ngày:** 2026-11-22
- **Nhánh:** `feat/tables` (stacked trên `feat/foundation-hardening`)
- **Spec:** `docs/superpowers/specs/2026-11-22-tables-design.md`
- **Plan:** `docs/superpowers/plans/2026-11-22-tables.md`
- **Final review:** Ready to merge — **Yes**

## Phạm vi đã giao

| Task | Commit | Nội dung |
| --- | --- | --- |
| 1 | `efd9c35` | Persist `openOrders`, nâng store `restodash-pos-v1` lên version 3 + migration v1/v2 |
| 2 | `c288232` | Swap model nhiều đơn mở, `served` theo dòng, khoá món đã ra |
| 3 | `c280cf9` | Suy ra trạng thái bàn (`empty`/`pending`/`served`), đếm món chưa ra |
| 4 | `0f835c9` | Server CRUD bàn + xoá mềm, idempotent theo `legacyId`, quyền OWNER/MANAGER |
| 5 | `d14ee5d` | Catalog store: thêm/xoá bàn offline, queue đồng bộ, merge sau refresh |
| 6 | `1fb5dfa` | Flush queue bàn khi trình duyệt online |
| 7 | `1903a49` | Modal thêm bàn có validate |
| 8 | `f01010d` | Trang Bàn theo khu vực + route `#/tables` |
| 9 | `5b7cb37` | Tick món đã mang ra + “Chọn tất cả” trên OrderPanel |
| 10 | `0b56c97` | Xác nhận 2 bước khi thanh toán còn món chưa ra |
| 11 | `a3f311c` | Cập nhật `PROJECT.md` / `README.md` + verification |

Mỗi task do một subagent implement (TDD), sau đó controller review spec + quality. Ledger và review package nằm trong `.superpowers/sdd/2026-11-22-tables/`.

## Kiểm tra cuối

| Lệnh | Kết quả |
| --- | --- |
| `npm test` | 38 file / **242/242** pass |
| `npm run lint` | exit 0 (4 warning có sẵn trong `router.tsx`) |
| `npm run build` | pass |
| `server npm test` | 11 file / **64/64** pass |
| `server npm run lint` | exit 0 |
| `server npm run test:e2e` | 13 file / **108/108** pass |

So với trước module: root 179 → 242, server unit 57 → 64, e2e 75 → 108.

## Final review

- Spec compliance: ✅ toàn bộ yêu cầu được triển khai, 12 Global Constraint giữ vững.
- Cross-task integration: không có lỗi; 3 contract HTTP/204, role guard, UUID-safe payment đã được kiểm chứng.
- 17 góp ý Minor từ các task review đều được accept (không chặn merge) — chi tiết trong ledger.
- Không có Critical/Important.

## Ghi chú

- Đổi brand RestoDash → Serva là task riêng cuối dự án, không nằm trong module này.
- E2E cần Postgres + `TEST_DATABASE_URL`; đầy đủ 13 file e2e đã chạy trong lần verification này.
