# SÀI GÒN 2026 — BÀN GIAO PHẦN BẢN ĐỒ CUỐI

Cập nhật: 2026-11-28 · nhánh `arena/f56eaa67-scam-maze` · commit cuối ghi ở mục 1.

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
| **Đai chuyển tiếp quanh map cũ** | **chưa** — vành 18 m đang là đất trống |
| **Khu phố gốc (khupho) trong trang engine** | **chưa cắm** — `city.core` để trống |
| Đèn ngã tư cho phố thủ tục | **chưa** |
| Bus 06 chạy tuyến thành phố | **chưa** |
| Dải phân cách đại lộ thủ tục | **chưa** |
| Kiểm bằng mắt trên máy thật | **chưa** (sandbox crash GPU, xem §6) |

Commit cuối: `7cafd0c`.

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

## 7. Việc còn lại, theo thứ tự làm

### 7.1 Cắm khu phố gốc (khupho) vào trang engine — **làm trước tiên**
`cityMesh` đã cắt đất cho `city.core` nhưng `SaigonEnginePage` **chưa** gọi `buildCoreWorld`
(`citymap/coreWorld.ts`, mẫu ở `CityPage.tsx:185-215`). Hiện tại chỗ đó là đất trống giữa thành phố.
Làm: `buildCoreWorld(city.core.x, city.core.z, {...})`, `engine.scene.add(world.root)`, gọi
`world.update` trong vòng lặp của trang (hoặc `world.update(dt, t)` từ một `rAF`), dispose khi unmount.

### 7.2 Đai chuyển tiếp quanh map chuẩn (đang là vành trống 18 m)
Quy tắc đề xuất: dải rộng 18 m sát mép vùng map chuẩn, **quay mặt ra map cũ**:
- hè 3 m + bó vỉa (dùng đúng vật liệu của `cityLayer`), cao độ 0,17 m;
- dãy nhà thấp 3–5 tầng, cao ≤ 12 m, sâu 8–12 m, mặt đứng dùng `facadeTexture` như nhà thành phố;
- cây thật (`SaigonBotanicalBatch`) thưa 8–10 m, cột đèn mỗi 22 m;
- **không** đặt gì chồng lên đường của map chuẩn (vẫn lọc bằng `partHitsRealMap`).
Mục tiêu: đứng trong map cũ nhìn ra không thấy vành đất trống, và mép thành phố có mặt tiền.

### 7.3 Nền 9 km khớp tông
Hiện là `MeshLambertMaterial("#55544a")` phẳng. Lấy mẫu màu đất của engine (ground của
`saigonDistricts`) hoặc thêm 2–3 lớp vân rất nhẹ để không thành tấm xám tuyệt đối.

### 7.4 Đèn ngã tư cho phố thủ tục
`extendTrafficGraph` đã góp tuyến vào `engine.traffic.graph`; đánh dấu `signalized: true` cho các
ngã tư mới và gọi `bindVisual` của `TrafficSignalController` (xem
`testbus/openworld/traffic/signalController.ts`) để cột đèn + đếm giây hiện ra như map chuẩn.

### 7.5 Dải phân cách đại lộ
Map chuẩn có tim kép vàng; đại lộ thành phố nên có dải phân cách cứng (bó vỉa 0,15 m + cỏ/bê tông)
giữa hai chiều ở những đoạn dài > 40 m — hiện chỉ có vạch kẻ.

### 7.6 Bus 06 chạy tuyến thành phố
`engine.route` / `engine.traffic.busCircuit` là tuyến của map chuẩn. Nối thêm vòng thành phố bằng
`cityTraffic` (đã có `edgeIds`), giữ nguyên luật dừng/đón khách của engine — **không** viết vòng lặp bus mới.

### 7.7 Hiệu năng
Ngân sách hiện tại: build 3,3 s; 4804 khối cản; 10 tuyến giao thông; 10 xe. Nếu thêm đai/nhà thì đo lại
`perStepMs` của `engine.traffic` (mục tiêu < 0,5 ms/bước) và số draw call (< 260).

---

## 8. Câu chốt để không lạc

Người chơi sống ở phòng 6.07, nhà trọ 59, hẻm 462/14 Lý Thái Tổ. Bước ra hẻm là Sài Gòn 2026 thật:
Đại lộ 3/2, Hải Triều, Đại lộ Đông, Bến Bình Thạnh, Landmark 81 — do map dựng tay; phần còn lại do
thành phố sinh, cùng khổ đường, cùng cao độ, cùng vật liệu, cùng luật giao thông. Không có chỗ nào
là hai thế giới chồng lên nhau, và không có chỗ nào là đất trống.
