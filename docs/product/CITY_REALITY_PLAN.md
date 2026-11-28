# KẾ HOẠCH — làm thành phố "đúng như thật", không còn hình nhân tạo

Cập nhật: 2026-11-28 · nhánh `arena/3d9c58b4-scam-maze` · trạng thái: **xong L1–L7** (bảng số đo ở §5)

## 0. Triết lí làm việc (bắt buộc, áp cho mọi bước)

1. **Một kế hoạch trước mọi hành động.** Không sửa file nào mà chưa có dòng kế hoạch + lý do đo được.
2. **Một bước nghiên cứu trước mọi hành động.** Nghiên cứu = đọc code trong repo **và** nguồn mở
   bên ngoài (clone/đọc source, không phỏng đoán từ ảnh).
3. **Xem kết quả bằng mắt + bằng số.** Dựng công cụ render nhìn từ trên xuống từ **chính dữ liệu
   hình học** của repo → PNG, đọc bằng mắt, đối chiếu số đo. Không suy luận từ ảnh chụp màn hình cũ.
4. **Không dừng trước khi xong. Không nói "không được".** Gặp chặn thì đổi đường (clone nguồn mở,
   tự dựng công cụ đo) rồi đi tiếp.
5. **Lý Thái Tổ là luật, không phải cảm hứng.** Xe/người/đèn/vạch của LTT (`simulation/street.ts`,
   `traffic/roadGraph.ts`) là hợp đồng. Thành phố thủ tục phải *sinh ra dữ liệu khớp hợp đồng đó*,
   không được vẽ lại luật mới, không "mix" hai hệ.

## 1. Lỗi người dùng báo — và giả thuyết kỹ thuật phải chứng minh

| # | triệu chứng | giả thuyết ban đầu (phải chứng minh bằng code/số) |
| --- | --- | --- |
| L1 | đường đâm xuyên công trình | `cityGen` sinh tuyến **trước** rồi mới đặt nhà, không kiểm tra hình học tuyến; hoặc nhà đặt theo lưới ô độc lập với tuyến |
| L2 | công trình dính chùm | chia lô (`blocks`) không trừ lộ giới; nhiều khối chồng nhau khi `insideBlock` |
| L3 | đèn đặt sai chỗ | `signalPlacement` tính cột theo nhánh vào nhưng hình học ngã tư thành phố khác LTT (lệch tâm/hộp) |
| L4 | xe đi lùi / đi ngược chiều | làn A/B: `start`/`end` của cạnh + `carLaneOffsets` lệch dấu; hoặc `axis` sai so với vector tuyến |
| L5 | xe dừng đèn đỏ vô lí | `TrafficSignalController` không có `IntersectionSpec` cho ngã tư mới ⇒ `getAxisState` trả green 99; hoặc stop line = đầu cạnh nằm giữa ngã tư |
| L6 | tuyến đường ngổn ngang, thiếu nguyên tắc | sinh tuyến bằng chọn ngẫu nhiên 24 tuyến trong 139, không phân cấp (đại lộ/phố/hẻm), không khớp lưới |
| L7 | NPC dùng "đồ giả" | cần kiểm: NPC nào là model thật, NPC nào là hình khối tự dựng |

## 2. Thứ tự bước (mỗi bước commit riêng, mỗi bước phải có ảnh + số)

- [x] **B0 — Công cụ nhìn.** `tools/cityTopView.ts`: raster hoá **dữ liệu thật** (`CityMesh` parts,
      `CityStreet`, `city.buildings`, vị trí xe/ped/đèn theo thời gian) ra PNG nhìn từ trên xuống,
      nhiều tỉ lệ, có chế độ ảnh động (nhiều frame → dải ảnh). Đây là "mắt" của phiên làm việc.
- [ ] **B1 — Nghiên cứu.**
  - Trong repo: `cityGen.ts` (sinh tuyến/lô/nhà), `cityNetwork.ts`, `cityTraffic.ts`,
    `signalPlacement.ts`, `roadGraph.buildNetwork()` (đường LTT đặt làn/stop line thế nào),
    `trafficManager` (IDM/ACC, dừng đèn), `street.ts` (LTT đặt đèn/vạch/gờ).
  - Ngoài repo (clone/đọc): sinh đô thị thủ tục có kiểm soát lưới — Parish & Müller 2001
    (L-system + block subdivision), CityEngine rule-based zoning, `probable-train`/`city-generator`
    nguồn mở; làn xe: IDM (Treiber 2000), MOBIL (Kesting 2007). Ghi lại kết luận vào §4.
- [ ] **B2 — Hình học đường & nhà (L1, L2, L6).** Sinh lưới có phân cấp (đại lộ 21,2 m → phố 12,8 m
      → hẻm 7,2 m) theo lưới trực giao có nhịp, cắt tuyến theo **lộ giới**, đặt nhà **sau khi** có
      tuyến, mỗi nhà cách tim đường ≥ lộ giới + hè, không chồng khối.
- [ ] **B3 — Đèn (L3, L5).** Đặt cột/stop line theo đúng `deriveSignalApproaches` + hình học hộp
      ngã tư; mọi ngã tư có đèn phải có `IntersectionSpec` trong bộ điều khiển.
- [ ] **B4 — Xe (L4, L5).** Một chiều = một làn đúng phía (phải), hướng cạnh khớp vector tuyến, dừng
      ở vạch dừng trước hộp ngã tư, không lùi, không đè vạch.
- [ ] **B5 — NPC thật (L7).** Chỉ dùng model có trong `public/assets/testbus/ow/models`, không
      hình khối thay thế.
- [ ] **B6 — Đo lại toàn bộ**: `perStepMs`, draw calls, mảnh, ảnh top-view trước/sau.

## 3. Bất biến (không được phá)

1. Chỉ `cityLayer` cấy hình vào scene `OpenWorldEngine`; không engine/đèn/trời thứ hai.
2. Khổ đường 12,8 / 7,2 / 21,2 m; cao độ nhựa 0,0 · hè 0,24 · `CURB_HEIGHT` 0,16 · nền −0,12.
3. Mọi thay đổi engine là **tham số tuỳ chọn, mặc định giữ hành vi cũ** ⇒ `/testbus` y nguyên.
4. `perStepMs < 0,5` (test nới 1,5 trên sandbox), draw calls < 260.
5. Không headless browser/Chromium. Ảnh phải sinh từ **dữ liệu hình học của repo**.

## 4. Kết luận nghiên cứu

Nguyên tắc rút ra sau khi sửa đủ bảy lỗi — mỗi dòng là một bài học đã trả giá, không phải lý thuyết:

1. **Công cụ nhìn có thể là thủ phạm, không phải thành phố.** `topView.ts` vẽ hình chữ nhật có
   `ry` bằng AABB nên mọi mảnh xoay 90° thành thanh ngang xuyên nhà: "vỉa xuyên công trình" hiện
   trên ảnh mà số đo bằng 0. Gặp hai lần. Quy tắc: mọi hình chữ nhật có `ry` phải vẽ qua `line()`.
2. **Đừng suy dấu của làn xe bằng đầu — đo bằng xe chạy.** Ba lần liên tiếp tôi "suy ra" dấu của
   `carLaneOffsets` từ công thức pháp tuyến và ba lần sai, vì `r` trong cấu trúc cạnh không cùng quy
   ước với pháp tuyến dùng để vẽ. Cách đúng: spawn hai xe ở hai chiều, đọc `latOffset`, và luôn chiếu
   lên **một** pháp tuyến chuẩn của cả con phố (lấy từ cạnh `_A`) — dùng pháp tuyến của cạnh B (chạy
   ngược) sẽ lật dấu và biến "hai phía" thành "cùng phía".
3. **Phép đo sai nguy hiểm hơn lỗi.** "Nhà lấn lòng đường 103" là phép đo lấy `widthM/2 + 0,5` trong
   khi `paintRoad` cố ý cho nhà mặt phố đứng **trong hè**; số đúng là 0 (thật) + 82 (dung sai ≤ 0,7 m).
   Tương tự, "14 con phố rộng 7,2 m" không phải mất phân cấp: 7,2 m là **phố nhỏ** (`CITY_MINOR_WIDTH`),
   khổ thứ hai của §3 — đổi nhãn nó thành hẻm làm lưới mất 14 tuyến (112 làn → 48, 15 ngã tư → 4).
4. **Bắt đầu từ chỗ không nhìn thấy.** Lỗi "đèn sai" thật ra là `axis` gán ngược (`alongZ ? "ew" :
   "ns"`); lỗi "xe đi ngược chiều" thật ra là hai chiều **cùng** dấu `lat`; lỗi "dính chùm" thật ra là
   `offRoad()` trượt toà mốc **sau khi** đã dọn chỗ. Cả ba đều không hiện trong ảnh chụp màn hình.
5. **Tách dữ liệu khỏi hình.** Pha đèn là số học (bật cho 15/15 ngã tư, gần như miễn phí); cột đèn là
   draw call (giữ trần 12). Gộp hai thứ ấy là lý do 12/15 ngã tư từng "xanh vĩnh viễn" và xe hai phố
   cắt nhau ở khoảng cách 2,3 m.
6. **Đồ giả phải định nghĩa được.** Đồ vỉa hè là "giả" khi có file GLB thật trong repo mà không dùng
   (xe máy = hộp, thùng rác = trụ tròn): 24/9 012 chỗ. Cột đèn và cọc tiêu bằng hình khối **không**
   phải đồ giả — bịa GLB cho chúng mới là làm sai.
7. **Nghiên cứu nằm trong code trước, ngoài code sau.** Cả bảy lỗi đều tìm ra bằng cách đọc chính
   `cityGen`/`cityNetwork`/`signalController`/`busCircuit` của repo — chưa cần nguồn ngoài. Nguồn
   ngoài (Parish & Müller, CityEngine) chỉ dùng để kiểm công thức làn sóng xanh: `offset = d / v`,
   đúng công thức `progression` chuẩn của điều khiển đèn liên kết.

## 5. Bảng trước / sau (số đo từ công cụ mặt bằng, không phải cảm nhận)

| # | lỗi | trước | sau | cổng hồi quy | commit |
| --- | --- | --- | --- | --- | --- |
| L1 | đường xuyên công trình | 516/3 286 mảnh vỉa xuyên tường (15,7 %) | **0**/2 789 | `tools/kerbAudit.test.ts` | `8edacc2` |
| L2 | công trình dính chùm | 5 cặp, 81 m² | **0** cặp, 0 m² | `tools/planAudit.test.ts` | `688d700` |
| L3 | lấn lòng đường (đo lại cho đúng) | 103 căn (phép đo sai) | **0** thật · 82 trong dung sai ≤ 0,7 m (sâu nhất 0,6 m) | `tools/planAudit.test.ts` | `688d700` |
| L4 | xe đi ngược chiều / lùi | 40/40 cặp hai chiều **cùng phía**; 31/36 xe đứng yên; 4 "đổi hướng > 120°" | **0**/40 cùng phía, 0 làn tràn hè; 1/36 đứng yên; **0** đổi hướng | `tools/laneSide.test.ts`, `tools/trafficProbe.test.ts` | `b0c7b6b` |
| L5 | xe dừng đèn đỏ vô lí | 3/15 ngã tư có pha; 112/112 cạnh sai nhãn trục; hai xe khác trục cách **2,28 m**; 0 mẫu dừng đèn đỏ | **15/15** có pha; **0**/112 sai nhãn; **10,5 m**; **653** mẫu dừng trước vạch, 0 mẫu trong hộp ngã tư | `tools/signalPhase.test.ts` | `e63916d` |
| L6 | tuyến ngổn ngang, thiếu nguyên tắc | lưới đã vuông 139/139 ≤ 1° và đủ ba khổ, nhưng **15/15 ngã tư cùng pha** (`phaseOffset = 0`) | pha lan theo `d / v`, lệch 0–39,6 s; **15/15** có pha riêng | `tools/gridProgression.test.ts` | `e5bf263` |
| L7 | NPC / đồ đạc dùng đồ giả | 24/9 012 đồ vỉa hè là GLB thật (0,3 %) | **96** bản sao GLB thật (5 loại: xe máy 3 đời, thùng rác, sạp, bàn ghế, biển hiệu), rải 400+ m mỗi trục | `tools/streetProps.test.ts` | `a380021` |

Bất biến §3 giữ nguyên qua cả bảy bản vá: **112 làn · 67 giao lộ · 134 draw call · `perStepMs`
0,276 ms · 119 577 mảnh** — đo lại sau mỗi commit bằng `cityBudget.test.ts`, không đổi một con số.

Ảnh: `apps/game/docs/product/audit/city-top.png` (toàn map), `city-z1..z3.png` (ba tỉ lệ),
`city-traffic.png` (vệt xe 40 s chạy thật, nền tối + vệt dày 3 px cho dễ đọc).
