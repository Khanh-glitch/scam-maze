// Vietnamese Chapter 1 narrative overlay, decisions and debrief part (spec chapter-01-double-deception,
// task 11.4). Keys: `decisions/*` and `debrief/*` (including `debrief/analysis/*`).
// The debrief is read after the outcome, so it may name the deception plainly. It stays calm and
// never blames the player. Case ID, phone numbers and the bank name stay unchanged.

import type { NarrativeOverlay } from "../../../game/narrative/localize";

export const DECISIONS_VI: NarrativeOverlay = {
  "decisions/follow-recovery/label": "Làm theo các bước khôi phục của người gọi thứ ba",
  "decisions/follow-recovery/unavailableHint": "Bạn chưa nghe các bước khôi phục.",
  "decisions/follow-both/label": "Làm theo yêu cầu của cả hai người gọi",
  "decisions/follow-both/unavailableHint":
    "Bạn cần nghe yêu cầu của người gọi đầu tiên và các bước khôi phục trước.",
  "decisions/refuse-and-stop/label": "Từ chối và dừng lại ở đây",
  "decisions/refuse-and-stop/unavailableHint": "",
  "decisions/verify-independently/label": "Kiểm tra bằng số bạn đã lưu từ trước hôm nay",
  "decisions/verify-independently/unavailableHint":
    "Hãy gọi vào số đã lưu từ trước hôm nay trước, rồi quay lại lựa chọn này.",
  "decisions/verify-independently/preStep/label": "Gọi số in trên sao kê của bạn",
  "decisions/verify-independently/preStep/unavailableHint":
    "Hãy tìm số liên hệ in trên sao kê hoặc lưu trong ứng dụng ngân hàng của bạn trước.",
  "decisions/report-deception/label": "Báo cáo chuỗi lừa dối có liên kết với nhau",
  "decisions/report-deception/unavailableHint":
    "Hãy nối người gọi đầu tiên với thông báo trong ghi chú của bạn trước khi báo cáo.",

  "debrief/mechanism":
    "Đây là một kế hoạch gồm hai phần. Người gọi đầu tiên nhận là của ngân hàng, dùng sự gấp gáp và yêu cầu một mã. Sau đó, một thông báo trên máy tính xách tay, rồi một người gọi thứ ba, đưa ra quy trình khôi phục cho cùng mã hồ sơ NG-4471-X. Cuộc gọi đầu tiên tạo ra vấn đề, còn các lớp sau bán lời giải. Cả ba đều đến từ một nguồn chưa được xác minh.",
  "debrief/saferAlternatives/0":
    "Hãy kết thúc cuộc gọi, rồi tự liên hệ với ngân hàng bằng một số bạn đã lưu từ trước cuộc gọi, như số trên sao kê hoặc trong ứng dụng ngân hàng của bạn.",
  "debrief/saferAlternatives/1":
    "Không bao giờ đọc mã cho người gọi, kể cả khi họ biết mã hồ sơ hoặc nói rằng mã đó để bảo vệ bạn.",
  "debrief/saferAlternatives/2":
    "Hãy đối xử với một cảnh báo đồng tình với nỗi nghi ngờ của bạn như mọi lời khẳng định khác. Hãy hỏi nó đến từ đâu và bạn có kiểm tra được mà không dùng thông tin liên hệ nó đưa không.",
  "debrief/saferAlternatives/3":
    "Khi hai tin nhắn dùng cùng một mã hồ sơ hoặc cùng một số liên hệ, hãy tính chúng là một nguồn, không phải hai lần xác nhận.",
  "debrief/saferAlternatives/4":
    "Nếu người gọi yêu cầu bạn chuyển tiền, cài ứng dụng hoặc giữ kín cuộc gọi, hãy dừng lại. Những yêu cầu đó là lý do để kiểm tra, không phải lý do để vội.",

  "debrief/outcomeSummaries/false-victory":
    "Bạn đã từ chối cuộc gọi đầu tiên rồi tin lớp thứ hai. Lời cảnh báo trông như một sự xác nhận, nhưng nó chưa được kiểm tra qua một kênh do chính bạn chọn.",
  "debrief/outcomeSummaries/perfect-chain":
    "Cả hai lớp đã phối hợp với nhau trong mô phỏng. Mã và các bước khôi phục đến từ cùng một kế hoạch, khiến mỗi phần trông đáng tin.",
  "debrief/outcomeSummaries/break-the-chain":
    "Bạn đã kiểm tra qua một liên hệ đã lưu từ trước hôm nay, và điều đó phá vỡ chuỗi. Ngân hàng xác nhận họ không biết gì về hồ sơ, thông báo hay quy trình khôi phục nào.",
  "debrief/outcomeSummaries/unfinished-case":
    "Bạn đã dừng lại và không làm theo người gọi nào. Đó là một lựa chọn hợp lý. Các lời khẳng định vẫn chưa được kiểm tra, vì bạn chưa gọi cho số ngân hàng đã lưu.",

  "debrief/decisionNotes/hung-up":
    "Bạn đã kết thúc một cuộc gọi. Bạn luôn có thể làm vậy. Kết thúc cuộc gọi rồi kiểm tra qua một số bạn tin tưởng là bước then chốt.",
  "debrief/decisionNotes/opened-alex-record":
    "Bạn đã mở bản ghi cuộc gọi của Alex. Nó cho thấy mã hồ sơ và điều Alex yêu cầu, để bạn so với các tin nhắn sau.",
  "debrief/decisionNotes/opened-call-details":
    "Bạn đã mở chi tiết cuộc gọi. Số hiển thị là số của chính bạn, điều mà một cuộc gọi thật của ngân hàng thường không làm. Chi tiết này cần cân nhắc: một điều lạ chỉ là gợi ý, chưa phải bằng chứng.",
  "debrief/decisionNotes/opened-notification":
    "Bạn đã mở thông báo. Nó khớp với phản ứng đầu tiên của bạn, nên bạn thấy nó đáng tin. Nó chưa được đối chiếu với bất cứ điều gì bạn đã biết.",
  "debrief/decisionNotes/dismissed-notification":
    "Bạn đã bỏ qua thông báo mà không làm theo. Nó vẫn nằm trong lịch sử, nên bạn vẫn có thể xem lại sau.",
  "debrief/decisionNotes/inspected-origin":
    "Bạn đã xem ai gửi thông báo. Người gửi, tên ứng dụng (NG Secure Helper) và số liên hệ không khớp với thứ gì bạn đã lưu. Kiểm tra nguồn gốc là thói quen tốt trước khi làm theo một cảnh báo.",
  "debrief/decisionNotes/opened-bank-app":
    "Bạn đã mở ứng dụng ngân hàng do chính bạn cài. Đó là nơi tốt hơn để xem so với một đường link hay liên hệ nằm trong tin nhắn, nhưng riêng ứng dụng thì không xác nhận được lời người gọi nói.",
  "debrief/decisionNotes/checked-account-activity":
    "Bạn đã xem hoạt động tài khoản. Không có khoản thanh toán nào bị đánh dấu, và điều đó chưa giải quyết được câu hỏi. Chỉ ngân hàng mới xác nhận được có hồ sơ hay không.",
  "debrief/decisionNotes/checked-saved-contacts":
    "Bạn đã mở các liên hệ đã lưu trong ứng dụng ngân hàng. Số chính thức ở đó (+000 0100 0800) được lưu từ trước hôm nay, nên bạn có thể đối chiếu nó với những gì người gọi nói.",
  "debrief/decisionNotes/compared-case-ref":
    "Bạn đã so mã hồ sơ trong bản ghi của Alex với thông báo. Cả hai dùng NG-4471-X. Hai nguồn dùng chung một mã định danh có thể có cùng một tác giả.",
  "debrief/decisionNotes/compared-contacts":
    "Bạn đã so liên hệ trong thông báo với hồ sơ bạn đã lưu. Các số không khớp, đây là dấu hiệu thông báo không đến từ ngân hàng của bạn.",
  "debrief/decisionNotes/opened-review-security":
    "Bạn đã mở trang Xem xét bảo mật từ thông báo. Đây là một phần của lớp thứ hai, và là nơi quy trình khôi phục bắt đầu.",
  "debrief/decisionNotes/opened-recovery-details":
    "Bạn đã mở chi tiết cuộc gọi thứ ba. Số này khớp với liên hệ trong thông báo, nên người gọi thứ ba không phải là một người làm chứng riêng.",
  "debrief/decisionNotes/linked-same-source":
    "Bạn đã nối người gọi đầu tiên với thông báo. Họ dùng cùng một mã hồ sơ, nên họ không độc lập với nhau.",
  "debrief/decisionNotes/notification-not-from-bank":
    "Bạn đã phát hiện thông báo không khớp với hồ sơ ngân hàng bạn đã lưu. Thông tin liên hệ của nó không đến từ ngân hàng của bạn.",
  "debrief/decisionNotes/third-caller-linked":
    "Bạn đã nối người gọi thứ ba với cùng một nguồn. Một người gọi lặp lại cùng mã hồ sơ không cho bạn thêm bằng chứng mới.",
  "debrief/decisionNotes/decided-follow-recovery":
    "Bạn đã làm theo các bước khôi phục của người gọi thứ ba. Các bước đó đến từ cùng nguồn đã đưa ra cảnh báo, nên chúng chưa được kiểm tra.",
  "debrief/decisionNotes/decided-follow-both":
    "Bạn đã làm theo yêu cầu của cả hai người gọi. Mỗi yêu cầu khiến yêu cầu kia trông thuyết phục hơn, đó là cách một kế hoạch hai phần giữ vững.",
  "debrief/decisionNotes/decided-refuse-and-stop":
    "Bạn đã từ chối cả hai người gọi và dừng lại. Điều đó giữ bạn tránh xa kế hoạch, và gọi một số bạn đã lưu từ trước cũng sẽ cho bạn biết điều gì là thật.",
  "debrief/decisionNotes/decided-verify-independently":
    "Bạn đã kiểm tra bằng một số lưu từ trước hôm nay. Đó là bước có tác dụng: nó không phụ thuộc vào bất cứ điều gì những người gọi hay thông báo đã nói với bạn.",
  "debrief/decisionNotes/decided-report-deception":
    "Bạn đã báo cáo chuỗi lừa dối có liên kết với nhau. Chỉ ra các lời khẳng định liên quan với nhau như thế nào là hữu ích, và báo cáo cho ngân hàng qua một kênh bạn đã tin từ trước cũng vậy.",

  "debrief/analysis/pressureBuilt":
    "Alex dùng sự gấp gáp, quyền uy và một mã hồ sơ để cuộc gọi nghe như chính thức. Mỗi câu trả lời thêm áp lực và khiến bạn khó dừng lại kiểm tra hơn. Mục tiêu là lấy được một mã trước khi bạn kịp xác minh bất cứ điều gì.",
  "debrief/analysis/whyWarningLooked":
    "Thông báo trên máy tính xách tay đến ngay sau khi bạn từ chối người gọi đầu tiên, và nó đồng tình với bạn. Điều đó khiến nó giống như bằng chứng rằng bạn đã chọn đúng. Nó cũng đưa ra thông tin liên hệ riêng, và nó nêu cùng mã hồ sơ NG-4471-X. Những thứ khớp với nhau không độc lập nếu chúng đến từ một nguồn.",
  "debrief/analysis/thirdCallerNote":
    "Người gọi thứ ba lặp lại cùng mã hồ sơ và cùng liên hệ với thông báo. Đó không phải là bằng chứng độc lập. Chỉ cuộc gọi bạn tự gọi đến liên hệ ngân hàng đã lưu mới đến từ một kênh có từ trước khi nỗi lo xuất hiện.",
  "debrief/analysis/trapNotes/none":
    "Bạn đã không rơi vào cái bẫy nào. Bạn không đọc mã và không làm theo các bước khôi phục.",
  "debrief/analysis/trapNotes/first":
    "Bạn đã đọc mã trong cuộc gọi đầu tiên. Đó là cái bẫy của lớp thứ nhất, và một cuộc kiểm tra với ngân hàng sau đó vẫn có thể hạn chế những gì xảy ra tiếp theo.",
  "debrief/analysis/trapNotes/second":
    "Bạn đã làm theo lớp thứ hai. Lớp này được dựng cho những người vừa từ chối cuộc gọi đầu tiên, vì lúc đó họ đã bớt đề phòng.",
  "debrief/analysis/trapNotes/both":
    "Bạn đã đi vào cả hai lớp. Cuộc gọi đầu tiên tạo ra vấn đề và lớp thứ hai bán lời giải, đúng như cách kế hoạch được thiết kế để vận hành.",
  "debrief/analysis/verifyNextTime/0":
    "Hãy dừng lại, rồi kết thúc cuộc gọi hoặc đóng tin nhắn. Đừng dùng thông tin liên hệ mà nó đưa cho bạn.",
  "debrief/analysis/verifyNextTime/1":
    "Hãy tìm một liên hệ bạn đã lưu từ trước hôm nay: số trên sao kê, mặt sau thẻ hoặc ứng dụng ngân hàng của chính bạn.",
  "debrief/analysis/verifyNextTime/2":
    "Hãy hỏi thẳng ngân hàng xem hồ sơ, thông báo hoặc quy trình đó có tồn tại không.",
  "debrief/analysis/verifyNextTime/3":
    "Hãy tính các tin nhắn dùng chung một mã hồ sơ hoặc một số liên hệ là một nguồn.",
  "debrief/analysis/verifyNextTime/4":
    "Không bao giờ đọc mã hay chấp thuận một phiên điều khiển từ xa cho người đã liên hệ với bạn trước.",
};
