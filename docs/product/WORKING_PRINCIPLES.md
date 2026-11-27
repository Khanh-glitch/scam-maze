# Nguyên tắc làm việc — 4 điều owner chốt (27/11/2026)

File này sửa **cách tôi làm**, không sửa nội dung bản đồ. Mỗi mục ghi lại: owner nói gì → tôi đã
hiểu sai ở đâu → nó đổi gì trong cách làm.

---

## 1. Phi tuyến, không phải một lượt A → B

**Tôi đã sai:** bảng "6 bước + cổng chặn" ở tin nhắn trước đọc ra như một dây chuyền: xong beat
sheet mới được làm hợp đồng không gian, xong mới được vẽ. Đó là tuyến tính.

**Cách làm đúng — năm vòng chạy xen kẽ, mỗi vòng có quyền kéo lùi vòng khác:**

| Vòng | Nội dung | Đầu ra mỗi lần chạy |
|---|---|---|
| **R** — Research | tìm hiểu cách người khác đã giải đúng bài này | ghi chú + link + ảnh tham chiếu |
| **E** — Experiment | thử một thứ nhỏ, cô lập, xong trong 1 buổi | scene/test rời, có số đo |
| **I** — Inherit | lấy từ repo, từ OSS, từ dữ liệu công khai | mã/dữ liệu chạy được |
| **B** — Build | đưa vào game thật | chunk/asset trong game |
| **P** — Play | chơi thử, đo, nhìn | danh sách chỗ dở |

Luật: **mỗi lần B phải mở ít nhất một R và một I; mỗi lần P có quyền mở lại bất kỳ vòng nào.** Cổng
chặn chỉ dùng để chặn *phát hành*, không dùng để chặn *khám phá* — thử nghiệm không cần xin phép.

## 2. Nghiên cứu chen vào mọi mắt xích, không chỉ lúc khởi đầu

Mỗi mắt xích có câu hỏi riêng, và phải trả lời bằng nguồn ngoài, không bằng trí nhớ:

| Mắt xích | Câu hỏi phải đi tìm | Lấy ở đâu |
|---|---|---|
| Mặt tiền shophouse | Nhà ống Sài Gòn ngang 3,5–4 m xây thế nào: tầng lửng, tum, mái tôn, ban công, ô cửa cuốn? | ảnh đường phố, OSM `building:levels`, repo facade shader |
| Biển hiệu | Chữ trên biển Sài Gòn dùng font gì, tỷ lệ chữ/khung, màu nền phổ biến? | ảnh thực địa, bảng hiệu trong OSM (`shop`, `name`) |
| Va chạm | Làm sao resolve capsule với vài nghìn AABB ở 60 fps? | `yairklo/procedural-city` (grid AABB, không phụ thuộc three) |
| Đám đông | Bao nhiêu người trong 60 m phố thì "thật" mà vẫn 60 fps? | GTA VI (mật độ người là tính năng), benchmark mobile |
| Mặt đường | Nhựa Sài Gòn: vá, vệt bánh, cống, vạch mờ, nắp hố ga | ảnh thực địa + PBR có sẵn trong repo |
| Âm thanh | Năm lớp tiếng nào luôn có mặt? | video đường phố, không phải trí nhớ |

Không có link/ảnh kèm theo thì một quyết định thẩm mỹ chưa được coi là đã nghiên cứu.

## 3. Không bắt đầu từ số 0 — thừa kế trước, viết sau

### 3.1 Đã có trong repo (kiểm tra ngày 27/11/2026)

| Có sẵn | Dùng để |
|---|---|
| `three`, `@react-three/fiber`, `@react-three/drei`, `postprocessing`, `n8ao`, `meshoptimizer` | render, hậu kỳ, nén mesh — **không cài thêm engine** |
| 77 GLB / ~73 MB (`public/assets/3d`), PBR textures (`pbrTextures.ts`) | props, vật liệu — tái dùng, không làm lại |
| `saigonDistricts.ts` (2.665 dòng) + `choLon.ts` (1.339) + `saigonRiverside.ts` | massing, vỉa hè, đèn, cây, biển — mở rộng, không viết mới |
| `roadGraph.ts`, `TrafficManager.ts`, `busCircuit.ts` | mạng đường + làn + tuyến buýt đã có |
| `storyNpcs.ts`, `humanPresence`, `streetClips.ts` | NPC có nghề, cử động |
| `openWorldBounds.json` + audit + test | hợp đồng không gian đã khoá |

### 3.2 Open source đáng clone / đọc (chưa clone, ghi để dùng đúng lúc)

| Nguồn | Lấy gì | Không lấy gì |
|---|---|---|
| [`yairklo/procedural-city`](https://github.com/yairklo/procedural-city) | sinh road/block/lot/massing có seed; **grid AABB + `resolveCapsule` + `groundHeight` + raycast DDA** (thuần JS, không cần three) | thành phố generic của họ — Sài Gòn không phải lưới Mỹ |
| [`MHillier98/...CityGenerator`](https://github.com/MHillier98/IntroToComputerGraphics-CityGenerator) | ý tưởng random-walk đường | thuật toán quá thô cho đô thị thật |
| `three-mesh-bvh`, `recast-navigation-js`, `yuka` | tăng tốc raycast, navmesh, steering — **chỉ khi đo thấy cần** | thêm dependency trước khi có phép đo |
| `drei`, `postprocessing` | đã có sẵn trong repo | — |

Luật license: MIT/BSD dùng thoải mái (giữ notice); GPL/AGPL **không** đưa vào build; dữ liệu OSM
(ODbL) thì phải ghi credit trong game.

### 3.3 Dữ liệu thật — mỏ vàng còn bỏ ngỏ

- **OpenStreetMap Việt Nam**: PBF **319 MB**, cập nhật hằng ngày, **1.259.779 polygon nhà** toàn quốc
  ([Geofabrik](https://download.geofabrik.de/asia/vietnam/)). Cắt bbox 700 m quanh phòng 6.07 là có
  **footprint thật của từng căn nhà** quanh đó — massing thôi bịa hình chữ nhật.
- Ngoài ra: Overture Maps / Google Open Buildings (footprint từ vệ tinh) cho chỗ OSM thiếu.

Đường ống đọc PBF + trích theo bbox đã dựng và **đã test trên byte thật** (572 toà, 2.577 đường,
1.613 POI từ Kamppi): xem [OSM_DATA.md](./OSM_DATA.md).

**Giới hạn của sandbox này (đã test, không đoán):** `download.geofabrik.de` và `overpass-api.de` trả
`000` — không tải được. `api.github.com` thì được. Nên bước trích xuất OSM phải chạy **trên máy owner**
(hoặc qua một extract đặt trên GitHub), còn tôi viết script + test bằng fixture nhỏ, để khi có file là
chạy được ngay.

## 4. Thế giới không phải kết quả của checklist

10 ngưỡng trong `ART_BAR_SAIGON_2026.md` là **sàn**, không phải trần: chúng dùng để chặn đồ dở, không
dùng để sinh ra đồ hay. Một thế giới đạt đủ 10 ngưỡng vẫn có thể chán.

**Năm bài kiểm tra "đứng độc lập mà vẫn hay":**

1. **Đi dạo** — 10 phút, không mục tiêu, không HUD: vẫn có chuyện để xem.
2. **Postcard** — 5 khung hình đẹp, không cần một chữ nào.
3. **Một đoạn phố kể một chuyện** — chọn 80 m bất kỳ, kể được 3 chuyện nhỏ, không hội thoại.
4. **Tháo nhiệm vụ** — tắt toàn bộ mission: vẫn có thứ để làm (bán hàng, ngồi quán, nghe lén, chạy xe).
5. **Tháo người chơi** — camera tự chạy 60 giây: vẫn đáng xem.

Đạt dưới 3/5 thì thế giới đó là phông nền có va chạm, chưa phải thế giới.

---

## 5. Ba vòng tiếp theo, chạy xen kẽ (không tuần tự)

| Vòng | Việc | Xong khi |
|---|---|---|
| **I1** | Script cắt OSM theo bbox + fixture 20 toà để test offline | chạy được trên fixture; có hướng dẫn 1 lệnh cho máy owner |
| **R1 + E1** | Thử **một** mặt tiền shophouse từ footprint thật: 6 biến thể + shader, dựng trong 1 chunk test | nhìn ở 0,5 / 3 / 15 / 60 m thấy được cả 4 tầng chi tiết |
| **P1** | Đi dạo 10 phút trong chunk đó, chấm 5 bài kiểm tra ở §4 | có danh sách chỗ dở, quay lại R/E |

Sau P1, danh sách chỗ dở quyết định vòng sau — không phải bảng kế hoạch này.
