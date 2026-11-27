# Dữ liệu OSM thật → hình học (đường ống + bằng chứng)

Mục tiêu: **không bịa footprint.** Nhà, đường, tên hàng quán lấy từ dữ liệu thật, rồi mới dựng hình.

## 1. Đã có gì (chạy được, đã test trên byte thật)

| Thành phần | Đường dẫn | Việc |
|---|---|---|
| Bộ đọc PBF | `apps/game/src/features/testbus/openworld/world/osm/osmPbf.ts` | Tự viết, không dependency: BlobHeader/Blob (raw + zlib), PrimitiveBlock, DenseNodes, Node, Way, **Relation multipolygon**. Bỏ LZMA (đếm, không đoán) |
| Bộ trích xuất | trong cùng file: `extractOsmWorld(bytes, bbox)` | Lọc bbox, dựng vòng nhà, ghép multipolygon (trừ sân trong), chiều rộng đường theo `highway=*`, POI có tên, histogram tag |
| CLI | `apps/game/scripts/osm-extract.ts` | `node scripts/osm-extract.ts <file.pbf> --auto` → JSON + SVG + PNG + bảng số |
| Test | `.../osm/osmPbf.test.ts` | 9 test trên file thật: node/way/đường/nhà/POI/chiếu toạ độ/lọc bbox/tất định |
| Fixture | `apps/game/scripts/fixtures/osm/` | 2 file `.osm.pbf` thật (669 KB + 60 KB), ODbL |

Vì sao tự viết: repo không có toolchain native, game chạy trên browser, và bề mặt cần dùng chỉ ~450 dòng protobuf. `osmium`/`pyrosm` sẽ thêm Python + biên dịch vào một repo Node.

## 2. Bằng chứng: chạy trên Kamppi (Helsinki), 1,70 km²

```
node scripts/osm-extract.ts scripts/fixtures/osm/helsinki.osm.pbf --auto
```

| Số đo | Giá trị | Ý nghĩa |
|---|---|---|
| Node / way đọc được | 24.260 / 5.130 | giải mã đúng dense nodes + delta |
| Way không giải được ref | 78 / 5.130 = **1,5 %** | phần bị cắt ở mép extract |
| Toà nhà | **572** (63 multipolygon) | gồm cả toà ghép từ nhiều way |
| Diện tích có mái | 634.007 m² = **37,3 %** đất | mật độ đô thị châu Âu |
| Mật độ toà | 336 toà/km² | |
| Footprint | trung vị **810 m²**, p90 2.455 m² | |
| Đường | 2.577 way = **106 km** → 62,6 km/km² | gồm footway/steps trong công viên |
| POI | 1.613 (**1.139 có tên**) = 949 POI/km² | shop 299/km², quán ăn/uống 249/km² |

Ảnh plan: `node scripts/osm-extract.ts … ` sinh `osm-helsinki.png` — nhìn thấy đúng hình dạng thật: sân ga, dãy nhà có sân trong, phố mua sắm dày đặc POI.

**Ba con số đáng nhớ để chỉnh bản đồ của mình:** toà nhà thật ở khu dày đặc chiếm **37 % đất**, mỗi km² có **~950 POI** (riêng shop ~300), và **1,1 POI có tên mỗi 100 m đường**. Bản đồ hiện tại của SCAMMAZE: 5 POI trên 0,0364 km² = **137 POI/km²**, tức mỏng hơn ~7 lần so với một khu phố thật. *(Helsinki không phải Sài Gòn — dùng làm sàn tham chiếu, sẽ hiệu chỉnh khi có dữ liệu Sài Gòn.)*

## 3. Chạy cho Sài Gòn — một lệnh

```bash
# khung quanh phòng trọ 6.07 (Lý Thái Tổ, Q10 cũ), 700 m
node apps/game/scripts/osm-extract.ts vietnam-latest.osm.pbf \
  --bbox=10.7400,106.6400,10.7900,106.7100 --out=docs/product/audit
```

File 319 MB đọc mất vài chục giây, RAM ~1–2 GB (giữ toạ độ node trong khung + ref của mọi way).

## 4. Cái đang chặn (bằng chứng, không phải phỏng đoán)

| Đường | Kết quả |
|---|---|
| `download.geofabrik.de/asia/vietnam-latest.osm.pbf` | **000** (bị chặn egress) |
| `overpass-api.de` | **000** |
| `drive.google.com` / `drive.usercontent.google.com` | **000** |
| `api.github.com` | **200** (đã dùng để lấy 2 fixture) |
| File `vietnam-261126.osm.pbf` trong Drive | **334.526.827 byte** — kênh tải của connector giới hạn **100 MB** |
| Quyền chia sẻ file | chỉ owner (`mencan308@gmail.com`) |

Nên: byte của file Sài Gòn không vào được sandbox này qua bất kỳ đường nào đang mở. Đường ống thì
đã sẵn sàng và đã chứng minh trên byte thật — thiếu đúng phần dữ liệu.

**Điều tôi từ chối làm:** tự vẽ footprint "giống Sài Gòn" rồi gọi đó là dữ liệu thật. Sai một lần là
mọi số đo sau đó vô nghĩa.

## 5. Giấy phép

Dữ liệu © OpenStreetMap contributors, **ODbL 1.0**. Khi dùng trong game phải ghi credit
("Dữ liệu bản đồ © OpenStreetMap contributors, ODbL") ở màn hình credits/giới thiệu.
Fixture trong repo chỉ dùng để test.
