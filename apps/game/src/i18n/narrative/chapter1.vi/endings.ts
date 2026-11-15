// Vietnamese Chapter 1 narrative overlay, endings part (spec chapter-01-double-deception, task 11.4).
// Keys: `endings/<id>/{title,simulationLabel}`, `endings/<id>/variants/<variantId>/text` and
// `endings/<id>/aftermath/*`. Calm tone, no blame. Case ID and phone numbers stay unchanged.

import type { NarrativeOverlay } from "../../../game/narrative/localize";

const SIMULATION_LABEL = "Mô phỏng: không có điều gì thật sự xảy ra.";

export const ENDINGS_VI: NarrativeOverlay = {
  // false-victory
  "endings/false-victory/title": "Chiến thắng ảo",
  "endings/false-victory/simulationLabel": SIMULATION_LABEL,
  "endings/false-victory/variants/after-rejecting-alex/text":
    "Bạn đã từ chối Alex, và đó là một bản năng tốt. Lớp thứ hai đã tận dụng chính điều đó: người gọi tiếp theo đồng tình với bạn, và sự đồng tình làm các bước khôi phục có vẻ là bước hợp lý tiếp theo.",
  "endings/false-victory/variants/default/text":
    "Bạn đã làm theo các bước khôi phục của người gọi thứ ba. Chúng nghe như lời giải cho cuộc gọi đầu tiên, nhưng không điều nào trong đó được kiểm tra qua một kênh do chính bạn chọn.",
  "endings/false-victory/aftermath/consequence":
    "Trong mô phỏng, các bước khôi phục chuyển số dư sang một tài khoản tạm giữ do lớp thứ hai kiểm soát. Alex chưa bao giờ cần mã của bạn. Kế hoạch chỉ cần bạn tin giọng nói bảo rằng bạn đã thắng.",
  "endings/false-victory/aftermath/phone":
    "Điện thoại hiện một xác nhận ngắn từ nhóm theo dõi. Khi bạn gọi số mà nó đến từ, không ai nghe máy. Nhật ký cuộc gọi có ba mục, và cả ba đều dẫn về cùng một mã hồ sơ.",
  "endings/false-victory/aftermath/laptop":
    "Trang Xem xét bảo mật nói việc khôi phục đã hoàn tất. Số dư trong ứng dụng ngân hàng đã lưu giờ hiện một khoản chuyển mà bạn không định làm. Thông báo đã khởi đầu mọi chuyện vẫn còn trong lịch sử.",
  "endings/false-victory/aftermath/evidenceSummary":
    "Bạn đã tìm thấy một vài manh mối, nhưng không manh mối nào được đối chiếu với số đã lưu từ trước hôm nay. Mã hồ sơ NG-4471-X xuất hiện ở mọi lớp, và các lớp chưa bao giờ xác nhận cho nhau một cách độc lập.",
  "endings/false-victory/aftermath/caseReport":
    "Báo cáo vụ việc: cuộc gọi đầu tiên yêu cầu một mã và bị từ chối. Sau đó, một thông báo trên máy tính xách tay và một người gọi thứ ba dùng cùng mã hồ sơ NG-4471-X để đưa ra quy trình khôi phục. Lớp thứ hai có tác dụng vì nó đến sau một cảnh báo mà người chơi đã chấp nhận. Một cuộc gọi đến liên hệ ngân hàng đã lưu sẽ trả lời câu hỏi chỉ trong một bước.",

  // perfect-chain
  "endings/perfect-chain/title": "Chuỗi hoàn hảo",
  "endings/perfect-chain/simulationLabel": SIMULATION_LABEL,
  "endings/perfect-chain/variants/default/text":
    "Cả hai người gọi đều có được điều họ cần. Cuộc gọi đầu tiên tạo ra một vấn đề, và cuộc gọi thứ hai bán lời giải. Mỗi bước nghe có lý vì bước trước đó đã xảy ra rồi.",
  "endings/perfect-chain/aftermath/consequence":
    "Trong mô phỏng, mã từ cuộc gọi đầu tiên và các bước khôi phục từ cuộc gọi thứ ba cùng phát huy tác dụng. Kế hoạch cần cả hai phần, và mỗi phần làm phần kia trông đáng tin hơn.",
  "endings/perfect-chain/aftermath/phone":
    "Điện thoại đầy tin nhắn từ những số bạn không biết, tất cả đều nhắc đến mã hồ sơ. Nhóm theo dõi không còn nghe máy. Không có cuộc gọi nào để gọi lại và không có ai để hỏi.",
  "endings/perfect-chain/aftermath/laptop":
    "Ứng dụng ngân hàng đã lưu yêu cầu bạn đăng nhập lại, và việc đăng nhập không được. Một thông báo mới nói tài khoản đang được xem xét. Lịch sử giờ cho thấy cuộc gọi đầu tiên, thông báo và việc khôi phục nối thành một dòng.",
  "endings/perfect-chain/aftermath/evidenceSummary":
    "Các manh mối bạn tìm thấy cùng chỉ về một hướng: cuộc gọi, thông báo và người gọi thứ ba đều dùng NG-4471-X và liên hệ +000 0100 7771. Chúng giống như ba lần xác nhận, nhưng đều đến từ một nguồn.",
  "endings/perfect-chain/aftermath/caseReport":
    "Báo cáo vụ việc: một yêu cầu mã, một thông báo và một người gọi khôi phục tạo thành một kế hoạch. Cuộc gọi đầu tiên tạo ra vấn đề, các lớp sau đưa ra lời giải. Dừng lại sau một trong hai cuộc gọi và kiểm tra với liên hệ ngân hàng đã lưu sẽ phá vỡ chuỗi. Đây là một mô phỏng và bạn có thể chơi lại chương này.",

  // break-the-chain
  "endings/break-the-chain/title": "Phá vỡ chuỗi",
  "endings/break-the-chain/simulationLabel": SIMULATION_LABEL,
  "endings/break-the-chain/variants/case-report/text":
    "Bạn đã gọi vào số đã lưu từ trước hôm nay, và bạn còn chỉ ra các lời khẳng định liên hệ với nhau thế nào: cuộc gọi đầu tiên, thông báo và người gọi thứ ba dùng chung một mã hồ sơ. Báo cáo vụ việc chi tiết bên dưới lần theo toàn bộ chuỗi.",
  "endings/break-the-chain/variants/contained-late/text":
    "Mã bạn đưa trong cuộc gọi đầu tiên có một cái giá trong mô phỏng. Sau đó, bạn gọi vào liên hệ ngân hàng đã lưu và chặn lớp thứ hai trước khi nó bắt đầu. Ngân hàng có thể xử lý một mã đã bị chia sẻ, đó là lý do cuộc gọi này quan trọng.",
  "endings/break-the-chain/variants/default/text":
    "Bạn đã gọi vào số đã lưu từ trước hôm nay. Ngân hàng không có hồ sơ nào như vậy, không có thông báo nào như vậy và không có việc khôi phục qua điện thoại. Không điều gì ba người gọi nói được xác nhận.",
  "endings/break-the-chain/aftermath/consequence":
    "Trong mô phỏng, đường dây ngân hàng thật trả lời và nói hồ sơ không tồn tại. Các bước khôi phục không bao giờ được thực hiện. Ba giọng nói mất chỗ dựa chung duy nhất của chúng: sự tin tưởng của bạn.",
  "endings/break-the-chain/aftermath/phone":
    "Lịch sử cuộc gọi cho thấy một cuộc gọi do chính bạn gọi. Nhân viên khuyên bạn bỏ qua các số khác và chỉ cho bạn cách báo cáo chúng. Nhóm theo dõi gọi thêm một lần nữa, và bạn có thể để máy đổ chuông.",
  "endings/break-the-chain/aftermath/laptop":
    "Thông báo vẫn nằm trong lịch sử, nhưng bạn đã biết nó đến từ đâu. Ứng dụng ngân hàng đã lưu hiện tài khoản đúng như bạn để lại, không có khoản chuyển mới nào.",
  "endings/break-the-chain/aftermath/evidenceSummary":
    "Bạn đã đối chiếu các lời khẳng định với liên hệ đã lưu từ trước hôm nay (+000 0100 0800). Điều đó mâu thuẫn với người gọi, thông báo và các bước khôi phục. Bạn không cần mọi manh mối để đến được bước này.",
  "endings/break-the-chain/aftermath/caseReport":
    "Báo cáo vụ việc: ngân hàng xác nhận không có hồ sơ NG-4471-X, không có thông báo và không có quy trình khôi phục qua điện thoại. Liên hệ trong thông báo +000 0100 7771 không khớp với liên hệ đã lưu. Hãy giữ lại thời gian và số của các cuộc gọi nếu bạn báo cáo chuyện này cho ngân hàng.",

  // unfinished-case
  "endings/unfinished-case/title": "Vụ việc dang dở",
  "endings/unfinished-case/simulationLabel": SIMULATION_LABEL,
  "endings/unfinished-case/variants/evidence-built/text":
    "Bạn đã dựng được chuỗi bằng chứng và dừng lại trước bước cuối. Các lời khẳng định liên quan đã rõ, nhưng chưa ai xác nhận chúng qua số đã lưu từ trước hôm nay.",
  "endings/unfinished-case/variants/default/text":
    "Bạn đã dừng lại và không làm theo người gọi nào. Từ chối là một lựa chọn hợp lý. Câu hỏi ai đứng sau các cuộc gọi vẫn chưa có lời đáp.",
  "endings/unfinished-case/aftermath/consequence":
    "Trong mô phỏng, không có gì bị chuyển đi. Không có tiền rời khỏi tài khoản và không mã nào được dùng. Các lời khẳng định vẫn chưa được chứng minh, và những người gọi có thể thử lại.",
  "endings/unfinished-case/aftermath/phone":
    "Lúc này điện thoại yên ắng. Trong lịch sử có các cuộc gọi nhỡ và một thư thoại. Bạn chưa gọi vào liên hệ ngân hàng đã lưu, nên các số đã gọi cho bạn vẫn chưa được kiểm tra.",
  "endings/unfinished-case/aftermath/laptop":
    "Thông báo nằm đó chưa đọc hoặc đã đóng, và ứng dụng ngân hàng đã lưu không có gì bất thường. Tài khoản trông như trước, nhưng bạn vẫn chưa biết lời cảnh báo có thật hay không.",
  "endings/unfinished-case/aftermath/evidenceSummary":
    "Bạn đã giữ khoảng cách, và điều đó bảo vệ tài khoản trong mô phỏng. Khi chưa gọi vào liên hệ ngân hàng đã lưu, các manh mối bạn tìm thấy vẫn chỉ là câu hỏi chứ chưa là câu trả lời.",
  "endings/unfinished-case/aftermath/caseReport":
    "Báo cáo vụ việc: mã hồ sơ NG-4471-X chưa bao giờ được kiểm tra với ngân hàng. Các cuộc gọi và thông báo chưa được xác minh. Một cuộc gọi đến số đã lưu từ trước hôm nay là bước biến một nghi ngờ thành một câu trả lời. Hãy chơi lại để thử.",
};
