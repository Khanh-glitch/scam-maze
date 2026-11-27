# OSM fixtures

Hai file `.osm.pbf` thật, tải qua GitHub API, dùng để test bộ đọc PBF offline (sandbox này không
truy cập được Geofabrik/Overpass).

| File | Nguồn | Nội dung |
|---|---|---|
| `helsinki.osm.pbf` (669 KB) | [`pyrosm/pyrosm`](https://github.com/pyrosm/pyrosm) `pyrosm/data/Helsinki.osm.pbf` | ~24k node, 5k way, 520+ toà, 1.6k POI có tên — vùng Kamppi, mật độ cao, nhiều `shop`/`amenity` |
| `bayfront_singapore.osm.pbf` (60 KB) | [`valhalla/valhalla`](https://github.com/valhalla/valhalla) `test/data/bayfront_singapore.osm.pbf` | đường + POI, toạ độ tổng hợp (dùng để test đường, không dùng để test toà) |

Dữ liệu © OpenStreetMap contributors, giấy phép ODbL 1.0 — dùng trong repo này chỉ để kiểm thử.

Không thay bằng dữ liệu giả: mục đích là chứng minh bộ đọc chạy trên byte thật.
