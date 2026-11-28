# SÀI GÒN 2026 — BÀN GIAO PHẦN BẢN ĐỒ CUỐI

Cập nhật: 2026-11-28 · nhánh `arena/3d9c58b4-scam-maze` · commit cuối ghi ở mục 1.

Tài liệu này để **một người/agent khác tiếp tục mà không cần hỏi lại**. Đọc hết mục 2–4 trước khi sửa
dòng nào: ba mục đó là hợp đồng kiến trúc, không phải gợi ý.

---

## 1. Trạng thái

| Việc | Trạng thái |
| --- | --- |
| `/saigon` chạy trên **chính** `OpenWorldEngine` của `/testbus` | xong (`SaigonEnginePage.tsx`) |
| Thành phố thủ tục được **cấy** vào scene của engine | xong (`cityLayer.ts` → `addCityLayer`) |
| Dọn chồng lấn hình học với map chuẩn | xong (test `realClearance.test.ts`, 28/28 pass) |
| Khổ đường thành phố = khổ đường map chuẩn | xong (`roadSpec.ts`: 12,8 / 7,2 / 21,2 m) |
| Mở biên giới đi ra khỏi map cũ + vật cản nhà thành phố | xong (`engine.cityBounds` + `engine.citySolids`) |
| Nền đất (hết "mất nền") | xong (tấm nền 9 km trong `addCityLayer`) |
| **Đai chuyển tiếp quanh map cũ** | xong — [B] `transitionBelt.ts` (`f78f772`→`39ed4d2`) |
| **Nền đất 9 km có vân, khớp tông đất engine** | xong — [C] `cityGround.ts` (`7eed456`) |
| **Khu phố gốc (khupho) trong trang engine** | xong — [A] `buildCoreWorld` cấy vào `exteriorGroup` (`f78f772`) |
| **Mạng đường thành phố có ngã tư thật + nối vào cổng map chuẩn** | xong — `cityNetwork.ts` ([D]) |
| Đèn ngã tư cho phố thủ tục | xong — `citySignals.ts`, cùng `TrafficSignalController` của engine |
| Bus 06 chạy tuyến thành phố | xong — `cityBus.ts` (một `BusCircuit` thứ hai, cùng `BusRouteController`) |
| Dải phân cách đại lộ thủ tục | xong — [E] `cityMesh.ts`, `CURB_HEIGHT`, đoạn > 40 m |
| Test + ngân sách | xong — [G] 59 test `features/citymap`, 171 test `features/testbus` |
| Kiểm bằng mắt trên máy thật | **chờ ảnh pose của người dùng** (sandbox crash GPU, xem §6) |
| **Sửa lỗi "mất vân nhà/đường"** | xong — 4 file vân mặt đứng chết + vật liệu nhận IBL (`0419fb8`, mục 8) |

Commit cuối: `0419fb8` + commit B (vật liệu IBL).

---

## 2. Kiến trúc — ĐÃ ĐẢO CHIỀU, KHÔNG ĐƯỢC ĐẢO LẠI

Nguồn: `apps/game/src/features/citymap/SaigonEnginePage.tsx`

```
/saigon  (?engine=0 → CityPage cũ)
  └─ new OpenWorldEngine(el)                  ← runtime của /testbus, nguyên bản
       ├─ renderer ACES + EffectComposer      ← của engine
       ├─ AtmosphereSystem                    ← trời, PMREM 3 chế độ, sương, mưa, sấm
       ├─ street / districts / boardingHouse  ← map dựng tay, đúng 9 vùng đi được
       ├─ traffic: SaigonTrafficManager       ← đèn QCVN 41:2024, ACC/IDM+, sublane, OBB
       └─ scene
            ├─ (engine tự dựng) map chuẩn
            └─ addCityLayer(scene, city)      ← THÀNH PHỐ ĐƯỢC CẤY VÀO ĐÂY
                 ├─ nền 9 km (y −0,12)
                 ├─ cityMesh: nhựa, hè, bó vỉa, vạch, nhà, cây thật, cột đèn, đồ vỉa hè GLB
                 └─ gió cho shader cây (uniform uTime)
```

Ba câu phải thuộc:

1. **Engine là gốc.** Không dựng renderer/đèn/trời/vật liệu thứ hai trong `cityLayer` hay trong trang.
   Mọi thứ ánh sáng–không khí–giao thông là của engine.
2. **Thành phố là khách.** Nó chỉ *thêm hình*, và phải **nhường** đất cho map chuẩn.
3. **Hai trang dùng chung `addCityLayer`** (`/saigon` engine và `CityPage` cũ). Sửa hình học ở một nơi,
   không được fork bản thứ hai.

### Đường dữ liệu

- `cityGen.ts` → dữ liệu quy hoạch (`City`): khối, lô, đường, hẻm, prop, mốc, `core`.
- `cityMesh.ts` → hình học (`CityMesh`): các mảng `Part` (`boxes, flat, kerbs, prisms, gables, trunks,
  canopies, details, drums, poles`) + `anchors`.
- `cityLayer.ts` → biến `CityMesh` thành object trong scene: vật liệu, instancing, cây thật, GLB.
- `realWorldFootprint.ts` → 9 vùng của map chuẩn + lề (đường 2 m, **nhà 18 m**) + 2 toà thật.

### API đã thêm vào engine (giữ nguyên tên)

```ts
// OpenWorldEngine
public cityBounds: { x0: number; x1: number; z0: number; z1: number } | null = null;
public citySolids: Solid[] = [];   // AABB, cùng kiểu với boarding.ts:rect()
```

- `cityBounds`: vùng đi được mở rộng ra thành phố (`isWithinOpenWorld` chặn cứng ở mép 9 vùng).
- `citySolids`: hộp bao từng khối nhà thành phố, đẩy nhân vật như tường map chuẩn.
- `/testbus` không set hai biến này ⇒ hành vi **y như trước**. Đây là điều kiện không được phá.

---

## 3. Bản đồ file

| File | Vai trò | Ghi chú |
| --- | --- | --- |
| `citymap/SaigonEnginePage.tsx` (172) | trang `/saigon` mới | mount engine → cấy thành phố → nối giao thông → mở biên giới |
| `citymap/cityLayer.ts` (485) | **cấy** thành phố vào `THREE.Scene` | nền 9 km, instancing, cây thật, đồ GLB, uniform gió |
| `citymap/cityMesh.ts` (881) | hình học thành phố | `partHitsRealMap`, cắt theo `REAL_WORLD_RECTS`, chia ô tấm phẳng 24 m, cao độ nhựa 0 / hè 0,17 |
| `citymap/cityGen.ts` (2427) | quy hoạch | lề 18 m cho lô + prop; `anchorsServedByRealWorld` gồm `room` |
| `citymap/roadSpec.ts` (20) | khổ đường | `CITY_STREET_WIDTH = ROAD_WIDTH` (12,8, import từ engine) |
| `citymap/realWorldFootprint.ts` (80) | vùng map chuẩn | đọc `openWorldBounds.json`, `REAL_WORLD_BUILD_MARGIN_M = 18` |
| `citymap/cityTraffic.ts` | nối đồ thị giao thông | `extendTrafficGraph`, `spawnCityVehicles` |
| `citymap/CityPage.tsx` (629) | bản cũ, `?engine=0` | đối chiếu; **không** phát triển thêm |
| `testbus/openworld/world/OpenWorldEngine.ts` | engine | thêm `cityBounds`/`citySolids` |
| `testbus/openworld/world/saigonDistricts.ts` | map dựng tay | nhóm chân trời có `name = "hcmc-skyline-horizon"` để trang gỡ |
| `citymap/realClearance.test.ts` | test ranh giới | 4 test: 0 mảnh/0 nhà/0 prop trong vùng map chuẩn + khổ đường |

---

## 4. Bất biến (vi phạm là hỏng, kể cả khi ảnh trông "được")

1. **Không chồng lấn.** Mọi `Part` của thành phố phải cách 9 vùng của map chuẩn: mặt phẳng ≥ 2 m,
   vật đứng ≥ 18 m (`REAL_WORLD_BUILD_MARGIN_M`). Lý do: `openWorldBounds.json` là vùng **đi được**,
   dãy nhà map chuẩn sâu 10–18 m **ngoài** nó.
2. **Không bỏ nguyên tấm lớn.** Tấm phẳng > 24 m phải chia ô rồi mới lọc, nếu không sẽ có hố nền.
3. **Cao độ nối:** mặt nhựa thành phố = 0,0 m (bằng `street.ts`), hè/bó vỉa = 0,17 m (`CURB_HEIGHT`).
   Lệch là thấy bậc ở chỗ nối.
4. **Khổ đường:** 12,8 m (phố) / 7,2 m (phố nhỏ) / 21,2 m (đại lộ). Không bịa số mới; đọc `roadSpec.ts`.
5. **Không xoá thành phố, không thu nhỏ thành phố, không đổi seed** để "cho dễ".
6. **Không đụng `/testbus`**: engine phải chạy y như cũ khi không cấy thành phố.
7. **Không dựng hệ đèn/trời/vật liệu thứ hai.** Thiếu gì thì lấy của engine (`AtmosphereSystem`,
   `pbrTextures`, `SaigonBotanicalBatch`, `streetPropsGlb`, `TrafficSignalController`).
8. **Chất lượng ≥ 90% bản gốc**; 10% chỉ hi sinh ở phần tích hợp và không được kéo chất lượng xuống.

---

## 5. Kiểm chứng (chạy trước mỗi commit)

```bash
cd apps/game
npx tsc -b --noEmit                    # ~50 s
npx vitest run src/features/citymap    # 28 test, ~25 s
npx vite build                         # ~11 s
```

Runtime thật (in ra trong console của trang, **trước** khi GPU crash ở sandbox):

```
[console] [saigon] thành phố cấy vào engine trong 3261 ms · 10 tuyến · 4804 khối cản · biên {...}
```

Một điểm cần nhớ: **số "khối cản" = số khối nhà**, giảm đột ngột nghĩa là lề vừa ăn mất nhà.

---

## 6. Chỗ chặn duy nhất: không nhìn được bằng mắt trong sandbox

Chromium headless + SwiftShader 3,9 GB RAM **crash GPU process** khi render engine (`Page crashed!`)
sau ~55 s — kể cả `/testbus` thuần, nên không phải lỗi phần cấy. Đã thử: 320×220, `city=0&veh=0`,
chụp `toDataURL` thay CDP screenshot, cờ phần mềm. Không cứu được.

Cách duy nhất để thấy: **preview chạy trên máy người dùng** (`npx vite --host 0.0.0.0 --port 5174`,
mở `/saigon`). Nếu cần ảnh để so sánh trong phiên làm việc, hãy xin ảnh từ người dùng, hoặc thêm
`?probe=1` bật một khung nhỏ 640×360 + `renderer.setPixelRatio(0.6)` để giảm tải.

Pose kiểm tra sẵn có (nhận `?t=x,z&ty=&yaw=&pitch=`):

- Nguyễn Trãi: `?t=-98,56&ty=0.05&yaw=0.9&pitch=0.02`
- Lý Thái Tổ nhìn về Bitexco: `?t=-6,-70&yaw=3.1416&pitch=0.02`
- Từ ban công phòng 6.07 nhìn ra thành phố: mặc định (spawn trong phòng)
- Trên cao: `?t=20,-120&ty=4&yaw=0&pitch=-0.42`

---

## 7. Đã làm xong A–G (2026-11-28) và việc còn lại

| Mục | Nơi làm | Ghi chú kiến trúc |
| --- | --- | --- |
| **A** khu phố gốc trong trang engine | `SaigonEnginePage.tsx` | `buildCoreWorld(city.core.x, city.core.z)` cấy vào `engine.exteriorGroup`, dispose khi unmount |
| **B** đai chuyển tiếp 18 m | `transitionBelt.ts` | hè 3 m + bó vỉa, nhà 3–5 tầng ≤ 12 m quay mặt vào map cũ, cây 9 m, đèn 22 m; đo từ **mép ngoài dãy nhà** (`realWorldFootprintUnion() ± 18`) |
| **C** nền 9 km có vân | `cityGround.ts` | `groundTexturePixels()` là hàm thuần số (jsdom không có canvas 2D), tông `#55544a` khớp đất engine |
| **D** đèn ngã tư | `cityNetwork.ts` + `citySignals.ts` | lưới đường chia tại mọi giao điểm, nối bằng `addCityLink` của engine; ngã tư bật `signalized` + `signals.registerIntersection(spec)` + `bindSignalVisual` |
| **E** dải phân cách đại lộ | `cityMesh.ts` | bó vỉa `CURB_HEIGHT` 0,16 m + mặt cỏ/bê tông, chỉ đoạn > 40 m |
| **F** Bus 06 vòng thành phố | `cityBus.ts` | **một** `BusCircuit` thứ hai từ `LTT_S_SB` qua lưới rồi về; luật lái là `planBus06` của engine (nay nhận `circuit` của từng xe), hình học tích phân bằng `stepCityBusMotion` thuần số; hook `engine.afterTrafficStep` mặc định `null` ⇒ `/testbus` y nguyên |
| **G** test + ngân sách | `cityNetwork/citySignals/cityMedian/cityBus/cityBudget.test.ts` | 59 test `features/citymap`, 171 test `features/testbus` |

Con số đo trên sandbox (không GPU): `build 2,1 s` · `10 tuyến / 44 làn / 29 giao lộ` ·
`perStepMs 0,066` · `draw calls ≈ 134` · `113 844 mảnh` · **240 test pass** (`features/citymap` 65, `features/testbus` 175).

### 7.1 Còn lại: kiểm bằng mắt
Chỉ còn nghiệm thu ảnh (xem §6): mở `/saigon` trên máy có GPU và gửi bốn pose. Mọi tinh chỉnh sau đó
là **thẩm mỹ**, không phải kiến trúc — nhưng vẫn phải giữ 6 bất biến ở §4.

### 7.2 Nếu phải mở rộng lưới đường
`MAX_CORRIDORS` mặc định 10 và xếp hạng `dist - 140 (nếu là đại lộ)`: xếp "đại lộ trước" tuyệt đối thì
mười suất bị các đại lộ xa chiếm hết và lưới quanh map chỉ còn vài tuyến. Tăng số tuyến thì đo lại
`perStepMs` — bộ mô phỏng duyệt mọi cung mỗi khung.

---

## 8. Câu chốt để không lạc

Người chơi sống ở phòng 6.07, nhà trọ 59, hẻm 462/14 Lý Thái Tổ. Bước ra hẻm là Sài Gòn 2026 thật:
Đại lộ 3/2, Hải Triều, Đại lộ Đông, Bến Bình Thạnh, Landmark 81 — do map dựng tay; phần còn lại do
thành phố sinh, cùng khổ đường, cùng cao độ, cùng vật liệu, cùng luật giao thông. Không có chỗ nào
là hai thế giới chồng lên nhau, và không có chỗ nào là đất trống.

---

## 8. Vì sao "mất vân nhà, mất vân đường" — và hai việc đã sửa

Triệu chứng người dùng báo: cả thành phố mất vân, chỉ còn biển hiệu emissive sáng, tường và
mặt đường ra khối phẳng tối.

**Nguyên nhân 1 — dữ liệu ảnh (việc A, `0419fb8`).** Đo độ lệch chuẩn độ xám (64×64, thang 0–255)
của các file mà `createWorldFacadePBR` nạp:

| file | trước | sau |
| --- | --- | --- |
| `q1/beige_wall_001-map.webp` | **0,20** (một màu tuyệt đối, 3,8 KB / 1024²) | 17,2 |
| `q1/clay_plaster-map.webp` | **1,75** (gần phẳng) | 9,9 |
| `q1/painted_plaster_wall-map.webp` | 2,93 (ảnh thật, bẹt tương phản) | 8,0 |
| `q1/concrete_wall_007-map.webp` | 3,44 (ảnh thật, bẹt tương phản) | 9,1 |

`beige_wall_001` là `travertine` của **14 toà nhà** (`addCommercialTower`) và `stuccoColors[0]` cho
mọi khối infill; `clay_plaster` là `warmLimestone` + 2 vật liệu Chợ Lớn. Nên "toà mất vân" không
phải lỗi renderer: hai file đó là ảnh một màu nằm sẵn trong `public/`. Hai file sau là ảnh thật nên
**chỉ kéo giãn tương phản từng kênh** quanh trung bình — tông không đổi một đơn vị nào.

Chặn hồi quy: `facadeAssets.test.ts` đo phương sai điểm ảnh, **không** đoán qua kích thước file
(`clay_plaster` tối màu nên nén còn 9,6 KB mà vẫn có vân thật — đây là bẫy của lần sửa đầu).

**Nguyên nhân 2 — vật liệu không nhận IBL (việc B).** `WebGLRenderer` chỉ gắn
`scene.environment` cho `MeshStandardMaterial` (`WebGLRenderer.js` ~1658, `WebGLPrograms.js` ~53).
Toàn bộ lớp thành phố là `MeshLambertMaterial`, nên PMREM ba chế độ của `AtmosphereSystem` **không
chiếu vào một bề mặt nào**: ban đêm tường chỉ còn hemisphere 0,62 + trăng 0,62 ⇒ xám bết. Chú thích
cũ ở `cityLayer.ts` hứa "khối PMREM bên dưới" nhưng khối đó chưa bao giờ tồn tại.

Đã sửa: nền đất, mặt đứng, mái, hè/sân, ốp chân tường, bó vỉa, lăng trụ, đầu hồi, cột đèn, thùng
chuyển sang `MeshStandardMaterial` **trên GPU**; trên renderer phần mềm vẫn là Lambert đúng cách map
chuẩn tự hạ chi tiết. Đo lại: **0 lô Lambert** trong lớp thành phố trên nhánh GPU
(`cityLayerMaterial.test.ts`), `draw calls ≈ 134` **không đổi** (B không thêm lô nào), chi phí là
shader: Lambert 57 uniform → physical 106 (`materialBudget.test.ts` in ra con số này).

Tuyệt đối **không** thêm khối PMREM vào `cityLayer`: trời/IBL là của engine (Single Engine).

---

## 9. Hạng mục H → K: chuẩn hoá đường/nhà/giao thông/đèn/xe/NPC theo Lý Thái Tổ

Bốn commit trên nhánh `arena/3d9c58b4-scam-maze`: **H** `eaae20b` (đường), **J** `6356748` (cây),
**I** `dd9f06e` (giao thông + đèn), **K** (người đi bộ + vạch đi bộ). Kế hoạch và checklist:
`CITY_STREET_UPGRADE_PLAN.md`.

### 9.1 Số đo trước → sau (`cityBudget.test.ts`, sandbox không GPU)

| số đo | baseline | sau H–K |
| --- | --- | --- |
| mảnh dựng hình | 113 844 | **120 052** (trần 165 000, `droppedParts` 0) |
| thân cây phố | 1 592 (chỉ 4 vị trí) | **2 830** |
| tuyến vào đồ thị | 10 (bán kính 520 m) | **24** (900 m) |
| làn / giao lộ / cổng nối | 44 / 29 / 1 | **112 / 67 / 2** |
| xe thành phố | 10 | **36** (2 xe/làn) |
| ngã tư có đèn | 4 | **12** |
| vạch đi bộ trong `roadGraph` | 11 (chỉ của LTT) | **21** (+10 của thành phố) |
| người đi bộ do brain điều khiển | 15 (chỉ LTT) | **15 + 40** |
| `perStepMs` | 0,058–0,066 | **0,322** (ngưỡng 0,5) |
| draw calls | ≈ 134 | ≈ 134 (K thêm NPC — xem 9.4) |

### 9.2 Bảng chuẩn Lý Thái Tổ → thành phố

| hạng mục | LTT | thành phố nay | ghi chú |
| --- | --- | --- | --- |
| hè mỗi bên | 6,8 m | 2,6 phố / 4,0 đại lộ / 1,1 hẻm | phố thủ tục rộng 7,2–12,8 m; hè 6,8 m trên đường 7,2 m là hè rộng gấp đôi đường. Giữ **tỉ lệ**, không giữ số tuyệt đối. |
| bó vỉa | viên 0,70 m, xen 20 % sậm | đoạn ≤ 40 m, màu xen nhịp 0,7 m | chia từng viên đẩy lên 178 233 mảnh — vượt trần, đã bỏ (xem 9.5) |
| vạch làn phố | 2 vạch, mỗi 5,6 m, dài 2,72 m | 2 vạch `±w/4`, đúng nhịp | chỉ `street`; đại lộ dùng tim kép vàng như LTT |
| vạch đi bộ | dải `crossing-map` phủ **hết** bề rộng đường | dải 0,55 m cách 0,92 m, phủ hết `w − 1,0` | H đầu tiên chỉ vẽ 6 vạch quanh tim (5,5 m giữa đường 12,8 m) — đã sửa cùng K |
| xe | mật độ liền nhau trên 4 làn | 2 xe/làn, 36 xe | trần CPU thật, xem 9.5 |
| đèn | 3 ngã tư / 236 m | 12 ngã tư trên 24 tuyến | cùng `TrafficSignalController` QCVN 41:2024 |
| người đi bộ | 15 người / 236 m | 40 người / 24 tuyến hè | cùng `PedestrianBrain` + `HumanRealismRig` + `HumanPresenceSystem` |
| gờ xúc giác, nắp hố ga | có | **chưa** | chi tiết nhỏ, để sau |

### 9.3 Mục K — hai thứ phải nối, không phải viết lại

1. **Chỗ đứng.** Hè LTT là dải cố định theo trục z; phố thủ tục chạy cả hai trục. `citySidewalkLanes()`
   sinh làn từ hình học tuyến (thuần số, test được), `PedestrianBrain` được mở thêm tham số **tuỳ
   chọn** `patrolAxis: "x"` (mặc định `"z"` = y nguyên hành vi cũ của LTT) nên không phải bẻ lái
   hành vi sau khi brain đã tính.
2. **Vạch đi bộ.** `PedestrianBrain` sang đường theo `graph.crosswalks` và `TrafficManager` chỉ bắt xe
   nhường khi cung rẽ có `turn.crosswalks`. Hạng mục H vẽ vạch nhưng **không** đăng ký vào đồ thị ⇒
   người đi bộ không bao giờ dùng tới. Nay `cityMesh` phát `CityMesh.zebras` (dữ liệu, không phải
   hình), `matchCityZebras()` khớp vạch với ngã tư **đã có đèn** (bỏ `CTYEND_*` — đầu cụt không có
   làn cắt ngang), `SaigonRoadGraph.addCityCrosswalk()` đăng ký và tính lại `turn.crosswalks`.

Không có bộ điều khiển người đi bộ thứ hai, không có `update` vòng lặp riêng: `cityPeds.update()`
chạy trong hook `engine.afterTrafficStep` cùng chỗ với xe buýt thành phố.

### 9.4 Đo trên trình duyệt

Sandbox không có GPU nên không chạy headless được. `apps/game/docs/product/peds-probe.js` dán vào
console của `/saigon` sẽ in ra: số NPC, số đang đứng đúng cao độ hè (y ≈ 0,24), số đã rời gốc toạ
độ, và sau 2 s thì quãng đường/tốc độ trung bình — tức bằng chứng "đi bộ thật" chứ không phải tượng
đứng. Kỳ vọng: ≥ 50 % số NPC `moved > 0,15 m` sau 2 s.

### 9.5 Hai trần đã chạm, đừng thử lại

- **Bó vỉa chia từng viên 0,70 m**: ~13 000 viên + 46 000 lăng trụ + 24 000 khối ⇒ **178 233 mảnh**,
  `push` cắt cụt map âm thầm. Chốt: đoạn ≤ 40 m, màu xen theo nhịp 0,7 m.
- **Mở rộng lưới/ xe bừa**: `TrafficManager` duyệt mọi cung × mọi xe mỗi bước. 24 tuyến / 36 xe cho
  `perStepMs 0,322` (đã tính 40 người O(n²)). Muốn hơn thì phải LOD/chia vùng theo khoảng cách
  người chơi, không phải nâng hằng số.
