# KẾ HOẠCH — chỉnh chu hệ đường/nhà toàn map theo chuẩn Lý Thái Tổ

Cập nhật: 2026-11-28 · nhánh `arena/3d9c58b4-scam-maze`

Yêu cầu: *"chỉnh chu lại hệ thống đường xá, nhà cửa toàn map, lấy khu Lý Thái Tổ làm chuẩn mức, và
mở rộng hệ thống giao thông, đèn, xe cộ, npc, hoạt động thật trên base là khu Lý Thái Tổ và phát
triển hơn nữa ra toàn map."*

## Mốc chuẩn đo được từ Lý Thái Tổ (`simulation/street.ts`)

| hạng mục | Lý Thái Tổ | thành phố thủ tục (trước) | hành động |
| --- | --- | --- | --- |
| hè mỗi bên | **6,8 m** (lòng đường 12,8 m + 2×6,8 = 26,4 m) | 1,6 m (phố) / 2,8 m (đại lộ) | **H** nới lên 2,6–4,0 m |
| bó vỉa | mỗi 0,70 m, đá sáng + 20% xỉn | một dải dài cả đoạn | **H** chia thành viên 0,70 m |
| vạch trắng giữa làn | hai bên tim, mỗi 5,6 m, dài 2,72 m | một vạch tim | **H** đủ hai bên |
| vạch đi bộ | ở `z = −76, −96, −147` | không có | **H** thêm ở ngã tư có đèn |
| gờ xúc giác / nắp hố ga | có | không có | để sau (chi tiết nhỏ) |
| cây | mỗi ~15 m, có cột đèn riêng | có, nhưng **không dùng lô cây thật ngoài map chuẩn** | **J** dùng `SaigonBotanicalBatch` toàn map |
| mạng đường vào đồ thị | — | 10 tuyến / 520 m | **I** mở rộng |
| đèn ngã tư | 3 ngã tư có đèn | 4 ngã tư | **I** theo mạng mở rộng |
| xe | — | 10 xe | **I** thêm |
| người đi bộ + hoạt động | 15 NPC, có đi bộ / đứng / xếp hàng | 0 | **K** thêm, dùng `PedestrianBrain` của engine |

## Bất biến phải giữ (không đổi trong suốt kế hoạch)

1. Chỉ `cityLayer` cấy hình vào scene của `OpenWorldEngine`; không dựng engine/đèn/trời thứ hai.
2. Khổ lòng đường **không đổi**: 12,8 / 7,2 / 21,2 m (`roadSpec.ts` ← `ROAD_WIDTH` của map chuẩn).
3. Cao độ: nhựa 0,0 · hè 0,24 (đỉnh) · `CURB_HEIGHT` 0,16 · nền thành phố −0,12.
4. `/testbus` y nguyên: mọi thay đổi vào engine phải là "tham số tuỳ chọn, mặc định giữ hành vi cũ".
5. `perStepMs < 0,5` (test nới 1,5 trên sandbox), `draw calls < 260`, chất lượng ≥ 90%.
6. Không headless browser; mọi phép đo là số, không phải ảnh.

## Các bước, theo thứ tự thực hiện

- [ ] **H — Đường phố theo đúng tiết diện Lý Thái Tổ**: nới hè, chia bó vỉa 0,70 m, hai vạch làn,
      vạch đi bộ ở ngã tư có đèn. Sửa trong `cityMesh.ts` (dữ liệu `Part`) — không đụng hình học của
      map chuẩn.
- [ ] **J — Cây thật toàn map**: bỏ điều kiện chỉ-trồng-ngoài-map-chuẩn trong `cityLayer.ts` khi
      chọn `SaigonBotanicalBatch`, để cây đường phố của thành phố dùng đúng bộ cây của Lý Thái Tổ.
- [ ] **I — Mở rộng giao thông**: tăng tuyến/bán kính trong `cityNetwork`, tuyến phụ (`minor`) vào
      đồ thị khi đủ dài, đèn ở mọi ngã tư có 4 nhánh, thêm xe.
- [ ] **K — NPC và hoạt động**: đăng ký người đi bộ bằng `PedestrianBrain.registerSidewalkWalker`
      trên hè của thành phố (dùng đúng hệ social-force + vạch đi bộ của engine).
- [ ] Đo lại: `build ms`, `perStepMs`, draw calls, số tuyến/ngã tư/xe/người.
- [ ] Cập nhật `CITY_MAP_HANDOFF.md` mục 9 với bảng trước/sau và commit riêng từng mục.
