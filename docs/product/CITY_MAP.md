# Bản đồ thành phố 1:8 — Sài Gòn 2026

Tài liệu này là bản kiểm toán của **bản đồ thành phố dùng trong game** (`cityGen.ts`), khác với bản
kiểm toán vùng mở cũ trong [`MAP_AUDIT.md`](MAP_AUDIT.md). Ở đây thành phố **được sinh ra từ dữ liệu
quy hoạch có kiểu** (`cityPlan.ts`) chứ không phải vẽ tay từng hình chữ nhật, và **mỗi lần sinh đều
phải qua một bài đo độc lập** trước khi được coi là xong.

```bash
node apps/game/scripts/city-audit.ts            # đo + xuất SVG/PNG/JSON, exit 1 nếu vi phạm cổng
node apps/game/scripts/city-audit.ts --no-png   # chỉ đo (nhanh hơn)
npx vitest run apps/game/src/features/citymap/cityGen.test.ts   # 11 test khoá hình dạng
```

Đầu ra: `docs/product/audit/city-plan.png` (ảnh dưới), `city-iso.png`, hai bản `.svg`, và
`city-metrics.json`.

## 0. Vì sao có bài kiểm toán riêng

Bản đồ tự sinh rất dễ "trông ổn" mà vẫn hỏng: một khối bị bọc kín thì người chơi không vào được, một
dãy mặt phố bị xoá thì cả con phố thành tường trống, một lô nhà thò xuống sông thì va vào nước. Những
lỗi đó **không nhìn thấy bằng mắt ở tỉ lệ 1:8** nhưng người chơi sẽ gặp trong 30 giây đầu.

Nên `city-audit.ts` là một chương trình **độc lập**: nó có lưới raster riêng, BFS riêng, và **không
import hàm đo nào của generator**. Nó đọc `generateCity()` như người chơi đọc — qua `isWalkable`,
`cellAt`, hình học toà nhà — rồi tự tính lại mọi con số. Nếu generator tự khen mình thì bài đo này
không tin.

## 1. Ảnh — bản đồ đo được

![Bản đồ thành phố](audit/city-plan.png)

Đọc ảnh:

- **Khung xám** = 1.220 × 790 m (0,96 km²), tỉ lệ 1:8 — một mét trong game là 8 m ngoài đời.
- **Ô màu** = toà nhà, màu theo loại (nhà ở, tiệm, kho, khách sạn, văn phòng…), cao độ theo số tầng.
- **Dải xanh đậm bên phải** = sông Sài Gòn (x 720–800); **dải ngang phía trên** = kênh Thị Nghè
  (z −312…−288).
- **Mảng xanh lá** = công viên Tao Đàn, **cắt theo khối** nên bốn mảng xanh nằm giữa phố chứ không
  nuốt mất phố.
- **Khối màu vàng đất** = chợ Bình Tây, chợ Bến Thành, ga Hòa Hưng; **khối xám lớn** = Landmark 81,
  Bitexco, Vietcombank Tower.
- **Chấm vàng nhỏ** = vật thể vỉa hè (xe máy, cây, thùng rác, đèn, sạp hàng).

Nhìn ảnh thấy ngay: phía tây (Hòa Hưng, Vườn Lại, Chợ Lớn) là **đặc nhà ống**; phía đông (Sài Gòn)
là **đại lộ tháp**; và mạng hẻm chạy khắp các khối chứ không chỉ có vành ngoài.

## 2. Số đo (lần chạy cuối, tái lập được)

| Chỉ số | Giá trị | Cổng |
|---|---|---|
| Khung / diện tích đất | 1.220 × 790 m = **0,96 km²** | — |
| Đi được | **383.374 m² = 0,3834 km²** (43,3 % đất) | 0,30–0,43 km² |
| Vùng rời rạc | **1** · lớn nhất 100 % · từ phòng tới được 100 % | 1 vùng, ≥99 % |
| Mái che | **0,503 km² = 56,7 % đất** · **5.241 toà** · trung vị 4 tầng | 45–68 % |
| Khối / sân chung | **55 khối · 105 sân** | — |
| Đường | **27,9 km** (12,4 km hẻm) = **29 km/km²** | 24–70 km/km² |
| Mặt tiền (trung vị theo tuyến) | **10,6 đơn vị + 6,0 chức năng / 100 m** · p10 3,8 · **61,3 % mét mặt tiền có nhà** | xem §3 |
| Mặt tiền theo phường | nhà ở **15,5 + 7,3** · chợ **12,0 + 6,3** · đang xây **12,8 + 6,9** · khách sạn **9,0 + 5,4** · công viên **7,6 + 2,5** · văn phòng **3,4 + 1,3** | ≥12 + ≥6 cho nhà ở/chợ/đang xây |
| Đoạn mặt tiền chết dài nhất | **195 m** (Võ Văn Kiệt) | báo cáo, không phải cổng — xem §3 |
| POI | **2.582** (32 venue + 2.550 cửa hàng) = **6.735 POI/km²** · 0 POI kẹt | 0 POI kẹt |
| Đi bộ 45 s tới POI | **97,6 %** diện tích · xa nhất **106 m** | ≥80 % |
| Chi tiết vỉa hè | **7.063 vật thể = 25,3 / 100 m** đường | ≥25 |
| Cao nhất | 461 m (Landmark 81) | ≥300 m |
| Thời gian sinh | **3,2 s** | — |

Số thô trong `docs/product/audit/city-metrics.json`; ảnh phẳng và ảnh trục đo trong cùng thư mục.

## 3. Ba chỗ phải nói thẳng (đo được, không giấu)

**(a) "12 đơn vị + 6 chức năng mỗi 100 m" không thể là một con số duy nhất cho cả thành phố.** Một
toà tháp 23 m mặt tiền trên Nguyễn Huệ đúng là chỉ có 4 đơn vị/100 m. Nên cổng được đo **theo loại
phường**: phố nhà ống (nhà ở 15,5 · chợ 12,0 · đang xây 12,8) phải đạt ≥12 + ≥6; đại lộ tháp và phố
khách sạn chỉ cần ≥3. Trung vị gộp toàn thành phố (10,6) vẫn in ra, nhưng **không dùng làm cổng** —
trộn hai chuẩn lại với nhau thì con số chẳng nói gì.

**(b) "Mặt tiền chết 37,8 %" là số báo cáo, không phải số để kết luận.** Khi một con phố và một con
hẻm chạy song song cách nhau vài mét, mỗi toà nhà chỉ thuộc về **một** tuyến (tuyến gần hơn); tuyến
còn lại bị tính là "trống" dù thực địa không trống. Vì vậy cổng là **tỉ lệ mét mặt tiền có nhà
(≥55 %, hiện 61,3 %)**, còn đoạn dài nhất (195 m) chỉ để soi. Sửa được chỗ này thì phải đổi cách quy
mặt tiền cho tuyến, không phải đổi ngưỡng.

**(c) POI được kiểm bằng hình học chính xác, không bằng lưới.** Lưới raster 0,5 m có ích để đo diện
tích và BFS, nhưng một POI đứng cách mặt tiền 1,1 m có thể rơi vào ô mà toà nhà phủ một phần. Lấy
lưới làm chuẩn sẽ báo lỗi ma. `isWalkable()` là chuẩn; lệch lưới chỉ được đếm là dung sai một ô.

## 4. Quyết định thiết kế đã chốt (và vì sao)

| Quyết định | Vì sao |
|---|---|
| **Mặt phố rải từ đường ra**, không phải từ vành khối vào | Rải từ trong ra để 40–48 % mặt tiền trống và 683 lô bị loại; rải từ đường ra thì tường phố liền mạch. |
| **Hẻm phải có miệng sâu ≥ một dãy nhà** (`ring[1] + 6`) | Miệng nông hơn thì ruột khối thành đảo kín, người chơi không vào được. |
| **Đại lộ chéo bị xoá khỏi quy hoạch** | Ba tuyến chéo cắt thành phố thành mảnh dẻo: mái 32,5 %, mặt tiền 3,2/100 m. |
| **Lô trên hẻm ghi `on: "hem"`** | Hẻm nhiều gấp ~10 lần đại lộ; ghi sai thì mọi chỉ số mặt tiền sai theo. |
| **Đường mà quá nửa lòng đường nằm trên sông thì bỏ** | Tuyến ven sông cũ chạy đúng mép nước: nửa lòng đường chìm dưới sông và cả dải mặt tiền phía đông không tồn tại (195 m tường trống). |
| **Công viên lớn hơn một khối thì cắt theo khối** | Một hình chữ nhật 180 m (Tao Đàn) nuốt luôn con phố chạy ngang qua nó. Cắt theo khối giữ nguyên mạng phố, công viên thành vài mảng xanh liền nhau. |
| **Vá ổ kín chỉ đục một đoạn tường mỏng nhất** và ưu tiên không phải tường mặt phố | Đường BFS chạy xuyên vật thể nên nó có thể chạy dọc bên trong cả dãy nhà và xoá sạch dãy đó (một dòng lỗi từng làm mất cả một con phố). |
| **Không đặt toà xuống sông/kênh** — chặn ở `addBuilding`, kiểm cả hình chữ nhật chứ không chỉ tâm lô | Kiểm tâm lô cho lọt 8 toà thò nửa thân xuống nước. |
| **Đo bằng trung vị theo tuyến, không phải trung bình mạng** | Trung bình bị toà 26 m mặt tiền kéo lệch; trung vị theo tuyến mới nói được "con phố này có nhà". |

Lỗi đã gặp và **không được lặp lại** (chi tiết trong lịch sử nhánh):

- `facing` phải hướng **ra khỏi** đường (`side < 0 ? "e" : "w"`); viết ngược → 1,4 đơn vị/100 m.
- Dời POI phải chạy **sau** bước phá dỡ, nếu không nó dời vào toà sắp bị xoá.
- Ổ kín phải **đục ra và đếm** (`connectionRepairs`), không được "sửa" bằng cách dời POI.
- Biến cục bộ không dùng làm `tsc -b` dừng trước khi audit chạy — luôn đọc đúng số dòng trình biên
  dịch chỉ ra.

## 5. Giới hạn — cái bài đo này **không** nói được

- Không có trình duyệt trong sandbox: ảnh trên là **plan view dựng từ chính dữ liệu va chạm**, không
  phải ảnh chụp 3D. Việc dựng hình (vật liệu, mái, biển hiệu, ánh sáng) vẫn phải xem trên máy owner.
- Màu sắc tường phố theo phường mới chỉ khác nhau ở **nhịp lô và số tầng**; sắc thái vật liệu (tôn
  rỉ Chợ Lớn, kính Nguyễn Huệ, tường vàng nhà ở) chưa vào dữ liệu.
- 105 sân chung/55 khối là con số hình học; chưa đo xem sân nào **nhìn** ra đường hay bị che.
- 45 s giây đi bộ dùng tốc độ 1,4 m/s; người chơi thật chạy nhanh hơn, nên 97,6 % là cận dưới.

## 6. Khi nào phải cập nhật tài liệu này

Sau mỗi lần đổi `cityPlan.ts` (mốc, quận, đại lộ) hoặc đổi `GRID` (nhịp lô, tầng, mật độ thương mại):
chạy `node apps/game/scripts/city-audit.ts`, rồi sửa bảng ở §2. Nếu cổng đổi, ghi rõ lý do vào §3 —
ngưỡng chỉ được đổi khi **cách đo** sai, không phải khi kết quả xấu.
