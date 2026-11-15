import type en from "../../en/chapter1/journalCombine";
import type { LocaleShape } from "../../../types";
const journalCombine: LocaleShape<typeof en> = {
  journalCombine: {
    heading: "Kết hợp bằng chứng",
    intro: "Chọn hai hoặc ba bằng chứng mà bạn nghĩ là có liên quan với nhau, rồi gửi đi.",
    selectedCount_one: "Đã chọn {{number}} mục",
    selectedCount_other: "Đã chọn {{number}} mục",
    selectPrompt: "Chọn bằng chứng",
    itemSelected: "Đã chọn: {{title}}",
    itemNotSelected: "Chưa chọn: {{title}}",
    needTwo: "Hãy chọn ít nhất hai mục.",
    tooMany: "Bạn chỉ có thể kết hợp tối đa ba mục.",
    submit: "Gửi phần kết hợp",
    clear: "Bỏ chọn tất cả",
    open: "Kết hợp bằng chứng",
    close: "Đóng",
    result: {
      accepted: "Đã ghi lại mối liên hệ.",
      rejected: "Các mục này không cho thấy mối liên hệ nào.",
      alreadyRecorded: "Bạn đã ghi lại mối liên hệ này rồi.",
      notAvailable: "Một trong các mục này chưa có trong sổ tay của bạn.",
    },
    deduction: {
      heading: "Các mối liên hệ",
      empty: "Bạn chưa ghi lại mối liên hệ nào.",
      statementLabel: "Điều này cho thấy",
    },
    related: {
      heading: "Các mối liên hệ có dùng mục này",
    },
    hint: {
      show: "Hiện gợi ý",
      hide: "Ẩn gợi ý",
      heading: "Gợi ý",
    },
    unverified: "Chưa được kiểm tra độc lập",
    announce: {
      recorded: "Đã ghi lại mối liên hệ: {{statement}}",
    },
  },
};
export default journalCombine;
