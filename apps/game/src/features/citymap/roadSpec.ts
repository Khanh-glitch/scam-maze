import { ROAD_WIDTH } from "../testbus/openworld/simulation/boarding";

/**
 * KHỔ ĐƯỜNG CỦA THÀNH PHỐ = KHỔ ĐƯỜNG CỦA MAP CHUẨN.
 *
 * `/saigon` chạy trên chính runtime của `/testbus`, nên chỗ hai bên gặp nhau phải cùng một khổ
 * đường thì mới nối liền: cùng bề rộng lòng đường, cùng chiều dày bó vỉa, cùng cao độ hè, và cùng
 * ô vân nhựa (12,8 m — xem `simulation/street.ts: repeat(1, L / W)`).
 *
 * Số ở đây **không chép tay**: `ROAD_WIDTH` là hằng của map chuẩn (`simulation/boarding.ts:58`),
 * `AVENUE_CORRIDOR` là bề rộng hành lang Đại lộ 3/2 đọc từ `openWorldBounds.json` — cùng file mà
 * `isWithinOpenWorld` dùng, nên nếu ai đổi đường bên map chuẩn thì thành phố đổi theo.
 */
export const CITY_STREET_WIDTH = ROAD_WIDTH;
export const CITY_MINOR_WIDTH = 7.2;
/** Hành lang Đại lộ 3/2 trong `openWorldBounds.json`: z −86,6 … −65,4. */
export const CITY_AVENUE_WIDTH = 21.2;
export const CITY_RING_WIDTH = ROAD_WIDTH;
/** Ô vân mặt nhựa, mét — bằng `ROAD_WIDTH` của map chuẩn. */
export const CITY_ROAD_TILE_M = ROAD_WIDTH;
