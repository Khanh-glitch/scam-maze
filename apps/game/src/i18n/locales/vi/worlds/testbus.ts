import type en from "../../en/worlds/testbus";
import type { LocaleShape } from "../../../types";

const testbus: LocaleShape<typeof en> = {
  testbus: {
    backToMenu: "Về Menu Chính",
    loading: "Đang chuẩn bị trạm xe buýt...",
    error: "Cảnh này cần WebGL 2. Hãy bật tăng tốc phần cứng hoặc dùng trình duyệt khác.",
    paused: "Đã tạm dừng. Nhấp để tiếp tục",
    resume: "Tiếp tục",
    clock: "Giờ",
    cash: "Tiền mặt",
    controls: "WASD di chuyển · Chuột nhìn · E tương tác · F chờ xe hoặc báo khởi hành · Shift chạy · Esc tạm dừng",
  },
};
export default testbus;
