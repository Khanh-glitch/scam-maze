# Bản đồ thành phố 1:8 — Sài Gòn 2026

Tài liệu này là bản kiểm toán của **bản đồ thành phố dùng trong game** (`cityGen.ts`), khác với bản
kiểm toán vùng mở cũ trong [`MAP_AUDIT.md`](MAP_AUDIT.md). Ở đây thành phố **được sinh ra từ dữ liệu
quy hoạch có kiểu** (`cityPlan.ts`) chứ không phải vẽ tay từng hình chữ nhật, và **mỗi lần sinh đều
phải qua một bài đo độc lập** trước khi được coi là xong.

```bash
node apps/game/scripts/city-audit.ts            # đo + xuất SVG/PNG/JSON, exit 1 nếu vi phạm cổng
node apps/game/scripts/city-audit.ts --no-png   # chỉ đo (nhanh hơn)
node apps/game/scripts/city-render.ts           # 6 ảnh 3D (không cần trình duyệt)
node apps/game/scripts/city-render.ts --view=avenue --no-png   # một ảnh, không xuất PNG
npx vitest run apps/game/src/features/citymap/cityGen.test.ts  # 14 test khoá hình dạng
```

Đầu ra:

- `docs/product/audit/city-plan.png`, `city-iso.png` — ảnh phẳng + ảnh trục đo, dựng từ chính dữ liệu
  va chạm.
- `docs/product/audit/city-metrics.json` — toàn bộ số đo.
- `docs/product/audit/city-{axon,hem,avenue,market,room,roof}.{svg,png}` — 6 ảnh 3D §1b.

## 0. Vì sao có bài kiểm toán riêng

Bản đồ tự sinh rất dễ "trông ổn" mà vẫn hỏng: một khối bị bọc kín thì người chơi không vào được, một
dãy mặt phố bị xoá thì cả con phố thành tường trống, một lô nhà thò xuống sông thì va vào nước. Những
lỗi đó **không nhìn thấy bằng mắt ở tỉ lệ 1:8** nhưng người chơi sẽ gặp trong 30 giây đầu.

Nên `city-audit.ts` là một chương trình **độc lập**: nó có lưới raster riêng, BFS riêng, và **không
import hàm đo nào của generator**. Nó đọc `generateCity()` như người chơi đọc — qua `isWalkable`,
`cellAt`, hình học toà nhà — rồi tự tính lại mọi con số. Nếu generator tự khen mình thì bài đo này
không tin.

## 1a. Ảnh phẳng — bản đồ đo được

![Bản đồ thành phố](audit/city-plan.png)

Đọc ảnh:

- **Khung xám** = 1.220 × 790 m (0,96 km²), tỉ lệ 1:8 — một mét trong game là 8 m ngoài đời.
- **Ô màu** = toà nhà, màu theo loại (nhà ở, tiệm, kho, khách sạn, văn phòng…), cao độ theo số tầng.
- **Dải xanh đậm bên phải** = sông Sài Gòn (x 720–800); **dải ngang phía trên** = kênh Thị Nghè
  (z −312…−288). Cầu Thị Nghè (x = 560, rộng 20 m) bắc qua kênh và **đi được trên mặt cầu**.
- **Mảng xanh lá** = công viên Tao Đàn, **cắt theo khối** nên bốn mảng xanh nằm giữa phố chứ không
  nuốt mất phố.
- **Khối màu vàng đất** = chợ Bình Tây, chợ Bến Thành, ga Hòa Hưng; **khối xám lớn** = Landmark 81,
  Bitexco, Vietcombank Tower.
- **Chấm vàng nhỏ** = vật thể vỉa hè (xe máy, cây, thùng rác, đèn, sạp hàng, đồ phơi).

## 1b. Ảnh 3D — sáu khung hình để *nhìn*, không chỉ để đo

`city-render.ts` là renderer phần mềm: camera phối cảnh có cắt gần, sắp xếp painter, đổ bóng một
nguồn, và xuất SVG rồi raster hoá bằng `sharp`. Không cần Chromium, không cần WebGL — nên **nhìn
được thành phố ngay trong sandbox**, không phải chờ máy owner.

| Ảnh | Trả lời câu hỏi |
|---|---|
| [`city-axon.png`](audit/city-axon.png) | Cả thành phố có đọc ra Sài Gòn không: mật độ, mạng phố, bốn cụm cao tầng, tên phường. |
| [`city-hem.png`](audit/city-hem.png) | Hẻm 2,7 m có thật sự là hẻm: tường hai bên, dây điện, biển hiệu, không lỗ hổng. |
| [`city-avenue.png`](audit/city-avenue.png) | Đại lộ 20 m: lòng đường + vạch tim + hai dãy mặt phố + cây. |
| [`city-market.png`](audit/city-market.png) | Chợ Bến Thành: sạp, mái, hàng quán, có nhìn thấy chợ từ chỗ đứng không. |
| [`city-room.png`](audit/city-room.png) | **Bước ra khỏi phòng 6.07 thì thấy gì** — ảnh này dùng đúng `city.start` của game. |
| [`city-roof.png`](audit/city-roof.png) | Mái nhà nhìn xuống mạng hẻm: độ dày khối, sân chung, bồn nước. |

Sửa thêm trong vòng "làm cho đẹp": **bỏ đế đen** (nay đất chạy ra ngoài khung, chỉ còn gờ mảnh),
**Landmark 81 là cụm ba tháp so le** (461 m + 305 + 231 m) thay vì một hộp trắng, **mái chợ là tôn rỉ
có gân** thay vì một tấm bê tông xám đọc ra "bãi đỗ xe", và **đường tối hơn mái / vỉa hè sáng hơn
mái** để mạng phố đọc được từ trên cao.

Hai lỗi renderer đã sửa trong vòng này, ghi lại để không lặp:

- **Camera đặt trong vật thể.** Ảnh "hẻm" từng có nửa khung hình là một tấm vải phơi ngay trước ống
  kính, ảnh "chợ" có một bức tường chiếm một phần ba khung. Nay mọi camera tầm mắt đi qua `nudge()`:
  đòi `isWalkable`, cách tường ≥1,2 m, cách vật thể ≥1,3 m, và ảnh chợ còn đòi **tia nhìn tới chợ
  phải trống**.
- **Mặt khuất nắng gần như đen.** Sàn sáng nâng 0,20 → 0,30 và thành phần trời 0,16 → 0,20; trước đó
  mặt quay vào camera mất hết khối.

## 2. Số đo (lần chạy cuối, tái lập được)

| Chỉ số | Giá trị | Cổng |
|---|---|---|
| Khung / diện tích đất | 1.220 × 790 m = **0,96 km²** | — |
| Đi được | **478.964 m² = 0,4790 km²** (54 % đất) | 0,30–0,52 km² (xem §3a) |
| Vùng rời rạc | **1** · lớn nhất 100 % · từ phòng tới được 100 % | 1 vùng, ≥99 % |
| Mái che | **0,407 km² = 46,0 % đất** · **4.345 toà** · trung vị 4 tầng | 42–68 % (xem §3a) |
| Khối / sân chung | **55 khối · 108 sân** | — |
| Đường | **27,1 km** (12,0 km hẻm) = **28,1 km/km²** | 24–70 km/km² |
| **Tim đường trống** | **100 %** · 0 tuyến bị chặn | **100 %** |
| **Mốc thật có toà** | **9 / 9** (Bitexco 262 m · Landmark 461 m · 3 chợ · 2 ga · Tao Đàn 4 mảng · phòng 6.07) | **9 / 9** |
| Mặt tiền (trung vị theo tuyến) | **14,6 đơn vị + 7,4 chức năng / 100 m** · p10 5,6 · **49,4 % mét mặt tiền có nhà** | xem §3b |
| Mặt tiền theo phường | nhà ở **16,9 + 7,9** · chợ **18,0 + 9,4** · đang xây **16,0 + 8,5** · khách sạn **9,7 + 5,0** · công viên **9,1 + 2,3** · văn phòng **6,1 + 2,5** | ≥12 + ≥6 cho nhà ở/chợ/đang xây; ≥3 + sàn 3 cho đại lộ tháp/khách sạn |
| Đoạn mặt tiền chết dài nhất | **610 m** (Cầu Thị Nghè — đoạn cầu vắt qua kênh) | báo cáo, không phải cổng — xem §3b |
| POI | **2.159** (32 venue + 2.127 cửa hàng) = **4.503 POI/km²** · 0 POI kẹt | 0 POI kẹt |
| Đi bộ 45 s tới POI | **97,8 %** diện tích · xa nhất **98 m** | ≥80 % |
| Chi tiết vỉa hè | **8.151 vật thể = 30,1 / 100 m** đường | ≥25 |
| Cao nhất | 461 m (Landmark 81) | ≥300 m |
| Thời gian sinh | **3,9 s** | — |

Số thô trong `docs/product/audit/city-metrics.json`; ảnh phẳng và ảnh trục đo trong cùng thư mục.

## 3. Những chỗ phải nói thẳng (đo được, không giấu)

**(a) Hai cổng đã được nới *vì cách đo cũ sai*, không phải vì kết quả xấu.**

Bản đồ có một bất biến mới: **không toà nhà nào được đè lên lòng đường** (§4, dòng đầu). Trước bất
biến đó, ~890 lô nhà nằm chồng lên lòng đường/hẻm của tuyến khác. Chúng vừa làm bẩn chỉ số "mặt tiền
có nhà" (một toà nằm giữa lòng đại lộ vẫn được tính là nhà mặt phố), vừa **ăn mất diện tích đi được**:
phần đất dưới chân chúng bị raster đánh dấu là vật cản, dù thực địa đó là đường.

Nay số đo đổi theo hướng trung thực hơn:

- đi được **0,3834 → 0,4790 km²**: phần tăng là đất đường bộ vốn bị nhà chiếm chỗ, không phải thành
  phố mới mở rộng. Trần cổng 0,43 → **0,52** vì lý do đó, sàn 0,30 giữ nguyên.
- mái che **56,7 % → 46,0 %**: cùng một lý do. Sàn 45 → **42**.
- "mét mặt tiền có nhà" **61,3 % → 49,4 %**: con số cũ bị thổi lên bởi đúng những lô nằm trong lòng
  đường. Cổng 55 → **45**.

Điều **không** đổi: hình dạng thành phố không mất phố nào (27,9 → 27,1 km đường, 55 khối), và mọi
cổng về tính đi lại vẫn đạt: 1 vùng, 100 % tới được từ phòng, 0 POI kẹt, 97,8 % trong 45 s.

**(b) "Mặt tiền chết 47,7 %" là số báo cáo, không phải số để kết luận.** Khi một con phố và một con
hẻm chạy song song cách nhau vài mét, mỗi toà nhà chỉ thuộc về **một** tuyến (tuyến gần hơn); tuyến
còn lại bị tính là "trống" dù thực địa không trống. Đoạn "chết" dài nhất (610 m, Cầu Thị Nghè) là
đoạn cầu vắt qua kênh — hai bên là nước, không thể có nhà. Cổng vì vậy là **tỉ lệ mét mặt tiền có
nhà (≥45 %)**, còn đoạn dài nhất chỉ để soi.

Mẫu số của mọi chỉ số mặt tiền là **đoạn tường phố**, không phải chiều dài hình học của tuyến: mỗi
bên tuyến lấy hợp các khoảng `front.intervals` (nở 6 m), bỏ bên có tường <30 m rồi mới chia. Cách cũ
(hai lần chiều dài tuyến) từng khiến một tuyến đi qua ngã tư bị tính là 57 % "ngã tư" — con số vô
nghĩa.

**(c) POI được kiểm bằng hình học chính xác, không bằng lưới.** Lưới raster 0,5 m có ích để đo diện
tích và BFS, nhưng một POI đứng cách mặt tiền 1,1 m có thể rơi vào ô mà toà nhà phủ một phần. Lấy
lưới làm chuẩn sẽ báo lỗi ma. `isWalkable()` là chuẩn; lệch lưới chỉ được đếm là dung sai một ô.

**(d) Điểm xuất phát từng nằm giữa đại lộ.** Mốc `room` chiếu ra đúng gốc bản đồ, mà trục Lý Thái Tổ
lại đi qua gốc — nhà của người chơi mọc lên giữa lòng đại lộ 20 m. Nay nhà trượt ra lô trống gần
nhất (x 11…19), và `city.start` là **cửa trước** (10,4; 0), cách tâm nhà 4,6 m, đứng được cả theo
hình học lẫn theo lưới. Test `điểm xuất phát không nằm trong tường` khoá điều này.

**(e) Sáu trong chín mốc thật từng KHÔNG có toà nào trên bản đồ** — và không cổng nào bắt được.
Bitexco (262 m), chợ Bến Thành, chợ Bình Tây, chợ An Đông và cả hai ga metro đều biến mất: hình chữ
nhật của mốc (66–90 m) đè lên lòng đường nên `addBuilding` từ chối, `clearArea` thì đã dọn sạch khối
trước đó — kết quả là một **ô trống** đúng chỗ đáng lẽ có chợ. Chợ Bến Thành còn bị ga Metro Bến
Thành (đặt sau, sát bên) xoá sạch vì `clearArea` dọn cả toà mốc.

Đã sửa: mốc **không bao giờ bị bỏ** (thu nhỏ dần tới khi vừa lô trống), chợ lớn **cắt theo khối** như
công viên, và `clearArea` **không đụng vào toà mốc**. Cổng mới: `anchorsMissing` phải rỗng và **mỗi
mốc phải có ≥1 toà**. Đây là loại lỗi mà mọi con số tổng hợp đều bỏ qua — chỉ ảnh chụp mới lộ ra.

## 4. Quyết định thiết kế đã chốt (và vì sao)

| Quyết định | Vì sao |
|---|---|
| **Mốc thật không bao giờ biến mất**: thu nhỏ dần cho vừa lô trống, chợ cắt theo khối, `clearArea` không dọn toà mốc | Sáu trong chín mốc từng không có toà (xem §3e). Không cổng nào bắt được vì mọi chỉ số tổng hợp vẫn đạt. |
| **Không toà nhà nào đè lên lòng đường** (mặt nạ đường vẽ theo từng tuyến, chặn trong `addBuilding`) | Lỗi cũ: 88/110 hẻm bị nhà chặn giữa, tức là bức tường vô hình giữa phố. Đo được 6.328 lần loại lô chỉ vì hai tuyến song song cách nhau 8 m. |
| **Hai tuyến song song quá sát thì bỏ tuyến hẹp** (`pruneTooClose`: |Δ| < (wA+wB)/2 + 24 m và chồng >8 m) | Giữ cả hai thì không có chỗ cho một dãy nhà giữa chúng; lô của tuyến này rơi vào lòng tuyến kia và bị loại. **Cầu không bao giờ bị bỏ** bởi luật này — cầu là chỗ vượt sông duy nhất. |
| **Lô góc bị cắt dần 0,6 m cho tới khi rời mặt nạ đường** (bỏ nếu <2,6 m) | Cắt cục bộ đúng lô, thay vì bỏ cả dãy ở ngã tư. Bỏ cả dãy từng làm mất 473 toà mà không tăng được mét mặt tiền nào. |
| **Hẻm phải cách hẻm cùng trục ≥ max(w1,w2)+2,5 m** (`tooClose`) | Hai hẻm sát nhau (0,2–2 m) nhập mặt nạ và không còn dải đất nào để xây. Hẻm bị bỏ được đếm (`hemSkipped`). |
| **Đầu hẻm dừng ở mép khối**, miệng hẻm bắc qua vỉa hè | Kéo dài hẻm qua vỉa hè ăn mất ~3 m mặt tiền đại lộ ở mỗi chỗ giao. |
| **Mặt cầu là mặt sàn đi được** (`decks`, vẽ sau nước trong raster) | Cầu không đi được là một lời nói dối trên bản đồ: tuyến có tên, có mặt đường, mà `isWalkable` trả `false` vì bên dưới là kênh. |
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
- Mẫu số mặt tiền **không** được là chiều dài hình học của tuyến (xem §3b) — và không được dùng
  "khoảng giao với tuyến khác" làm mẫu số: nó từng nói 57 % chiều dài thành phố là ngã tư.
- `pruneTooClose` phải chạy **trước** khi `mergedX/mergedZ` chia khối; nếu không, cặp tuyến quá sát
  vẫn tồn tại và lô nhà rơi vào lòng tuyến bên cạnh.
- Biến cục bộ không dùng làm `tsc -b` dừng trước khi audit chạy — luôn đọc đúng số dòng trình biên
  dịch chỉ ra.

## 5. Giới hạn — cái bài đo này **không** nói được

- Ảnh 3D là **renderer phần mềm trong repo**, không phải engine của game. Nó đúng về hình học, tỉ lệ,
  va chạm và ánh sáng một nguồn; nó **không** nói gì về shader, vật liệu, hay khung hình/giây trên máy
  owner.
- Màu sắc tường phố theo phường mới chỉ khác nhau ở **nhịp lô và số tầng**; sắc thái vật liệu (tôn rỉ
  Chợ Lớn, kính Nguyễn Huệ, tường vàng nhà ở) mới ở mức bảng màu, chưa vào dữ liệu.
- 108 sân chung/55 khối là con số hình học; chưa đo xem sân nào **nhìn** ra đường hay bị che.
- 45 giây đi bộ dùng tốc độ 1,4 m/s; người chơi thật chạy nhanh hơn, nên 97,8 % là cận dưới.
- Mặt cầu đi được, nhưng **lan can, dốc cầu và gầm cầu** chưa có trong hình học: cầu là một mặt sàn
  phẳng cùng cao độ với đường.

## 6. Khi nào phải cập nhật tài liệu này

Sau mỗi lần đổi `cityPlan.ts` (mốc, quận, đại lộ) hoặc đổi `GRID` (nhịp lô, tầng, mật độ thương mại):
chạy `node apps/game/scripts/city-audit.ts`, rồi sửa bảng ở §2. Nếu cổng đổi, ghi rõ lý do vào §3 —
ngưỡng chỉ được đổi khi **cách đo** sai, không phải khi kết quả xấu. Sau khi đổi hình học nhìn thấy
được (mái, tường, biển hiệu, ánh sáng): chạy `city-render.ts` và **mở ảnh ra nhìn** trước khi commit.
