import type en from "../en/chapters";
import type { LocaleShape } from "../../types";

// Title and subtitle match the Chapter 1 narrative overlay (`i18n/narrative/lastSubmission.vi.ts`).
const chapters: LocaleShape<typeof en> = {
  "chapter-1": {
    title: "LAST SUBMISSION: 72 GIỜ CUỐI",
    subtitle: "Nộp khóa luận trước 17:00 thứ Sáu.",
    assets: {
      "street-environment": "Đang tải con phố",
      sky: "Đang tải bầu trời",
      "call-phone": "Đang tải điện thoại",
      "city-district": "Đang tải khu phố xung quanh",
      "city-cars": "Đang tải xe đỗ",
    },
  },
  scenes: {
    "main-menu": "Menu chính",
    "intro-prologue": "Mở đầu",
    apartment: "Căn hộ",
    street: "Con phố",
  },
  placeholder: {
    heading: "Lối chơi của chương này vẫn đang được phát triển.",
    body: "Các tệp của chương đã tải xong và trạng thái ban đầu đã được tạo, nhưng cảnh chơi được thì chưa được xây dựng.",
    startLabel: "Địa điểm bắt đầu",
    originLabel: "Bắt đầu từ",
    origin: {
      "new-game": "Trò chơi mới",
      "saved-game": "Trò chơi đã lưu",
    },
  },
};

export default chapters;
