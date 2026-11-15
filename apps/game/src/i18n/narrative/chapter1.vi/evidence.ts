// Vietnamese Chapter 1 narrative overlay, evidence part (spec chapter-01-double-deception, task 11.4).
// Keys: `evidence/<id>/{title,description,location,relevance,debriefHint}` and
// `evidence/<id>/relations/<claimId>/note`. Case ID, phone numbers and domains stay unchanged.
// Clues that the player can read before the debrief avoid the words "lừa đảo" and "giả".

import type { NarrativeOverlay } from "../../../game/narrative/localize";

export const EVIDENCE_VI: NarrativeOverlay = {
  // ev.caller-id-anomaly
  "evidence/ev.caller-id-anomaly/title": "Số hiển thị là số của chính bạn",
  "evidence/ev.caller-id-anomaly/description":
    "Chi tiết cuộc gọi đầu tiên cho thấy số hiển thị là +000 0100 3300. Đó là số của chính bạn. Người gọi có thể tự đặt số hiện lên màn hình, nên chi tiết này cần được cân nhắc. Nó lạ, nhưng tự nó không cho biết ai đã gọi.",
  "evidence/ev.caller-id-anomaly/location": "Điện thoại, chi tiết cuộc gọi đầu tiên",
  "evidence/ev.caller-id-anomaly/relations/claim.alex-identity/note":
    "Một số hiển thị lạ là lý do để kiểm tra. Nó không chứng minh người gọi không phải của ngân hàng.",
  "evidence/ev.caller-id-anomaly/relevance":
    "Cho thấy số trên màn hình có thể do người gọi đặt, và một chi tiết lạ là lý do để kiểm tra, không phải kết luận.",
  "evidence/ev.caller-id-anomaly/debriefHint": "Chi tiết cuộc gọi đầu tiên cho thấy số hiển thị là số của chính bạn.",

  // ev.notification-metadata
  "evidence/ev.notification-metadata/title": "Thông báo đến từ đâu",
  "evidence/ev.notification-metadata/description":
    "Chi tiết cho thấy tên miền người gửi là northgate-alerts.invalid, một ứng dụng tên NG Secure Helper, mã hồ sơ NG-4471-X và số liên hệ +000 0100 7771 do chính thông báo đưa ra. Không thứ nào khớp với hồ sơ ngân hàng bạn đã lưu, nhưng bạn cần đối chiếu các chi tiết này với hồ sơ đó trước khi quyết định.",
  "evidence/ev.notification-metadata/location": "Máy tính xách tay, chi tiết thông báo",
  "evidence/ev.notification-metadata/relations/claim.notification-genuine/note":
    "Nguồn gốc trông lạ. Hãy so với những hồ sơ bạn đã lưu từ trước hôm nay.",
  "evidence/ev.notification-metadata/relevance":
    "Cho thấy cách đọc thông tin người gửi, và một số nằm trong tin nhắn không phải cách đáng tin để liên hệ với ngân hàng.",
  "evidence/ev.notification-metadata/debriefHint":
    "Chi tiết thông báo cho thấy một người gửi, một ứng dụng và một số mà bạn chưa từng lưu.",

  // ev.official-contact-paper
  "evidence/ev.official-contact-paper/title": "Số liên hệ in trên sao kê của bạn",
  "evidence/ev.official-contact-paper/description":
    "Sao kê giấy của bạn in số liên hệ của ngân hàng là +000 0100 0800 và địa chỉ northgate-bank.example. Tờ giấy được in từ trước hôm nay, nên đây là một hồ sơ mà cả hai người gọi đều không viết ra.",
  "evidence/ev.official-contact-paper/location": "Tờ sao kê ngân hàng gấp lẫn trong đống hóa đơn",
  "evidence/ev.official-contact-paper/relations/claim.notification-genuine/note":
    "Nó cho thấy một kênh đã có từ trước hôm nay. Nó chưa nói gì về thông báo cho đến khi bạn so các số với nhau.",
  "evidence/ev.official-contact-paper/relevance":
    "Cho thấy thói quen giữ sẵn một liên hệ đáng tin từ trước khi có bất kỳ tin nhắn nào đến.",
  "evidence/ev.official-contact-paper/debriefHint":
    "Tờ sao kê giấy trong đống hóa đơn in sẵn số ngân hàng mà bạn có thể dùng để kiểm tra.",

  // ev.official-contact-app
  "evidence/ev.official-contact-app/title": "Liên hệ đã lưu trong ứng dụng ngân hàng",
  "evidence/ev.official-contact-app/description":
    "Trang Liên hệ của Northgate Mobile, ứng dụng bạn đã cài từ trước hôm nay, ghi số ngân hàng +000 0100 0800 và địa chỉ northgate-bank.example. Đó là cùng số với sao kê giấy của bạn.",
  "evidence/ev.official-contact-app/location": "Máy tính xách tay, ứng dụng ngân hàng, mục Liên hệ",
  "evidence/ev.official-contact-app/relations/claim.notification-genuine/note":
    "Nó cho thấy liên hệ bạn đã lưu. Tự nó không xác nhận hay phủ nhận thông báo.",
  "evidence/ev.official-contact-app/relevance": "Cho một cách số hóa để đi đến cùng kết luận như sao kê giấy.",
  "evidence/ev.official-contact-app/debriefHint":
    "Ứng dụng ngân hàng do chính bạn cài ghi cùng một số ngân hàng với sao kê của bạn.",

  // ev.account-activity
  "evidence/ev.account-activity/title": "Không có khoản thanh toán nào bị đánh dấu trong hoạt động tài khoản",
  "evidence/ev.account-activity/description":
    "Trang hoạt động trong ứng dụng ngân hàng cho thấy các khoản thanh toán quen thuộc của bạn và không có khoản nào bị đánh dấu hay chặn. Đây là một kết quả yên ắng, không phải bằng chứng. Ứng dụng không phải là cuộc trò chuyện trực tiếp với ngân hàng, nên nó không trả lời được hồ sơ có tồn tại hay không.",
  "evidence/ev.account-activity/location": "Máy tính xách tay, ứng dụng ngân hàng, mục Hoạt động",
  "evidence/ev.account-activity/relations/claim.recovery-needed/note":
    "Một trang hoạt động yên ắng không cho biết có vấn đề hay không. Hãy hỏi ngân hàng qua một kênh bạn tin tưởng.",
  "evidence/ev.account-activity/relevance":
    "Cho thấy một nguồn yên ắng chưa phải câu trả lời, và kiểm tra khác với xác nhận.",
  "evidence/ev.account-activity/debriefHint":
    "Trang hoạt động tài khoản không có khoản thanh toán nào bị đánh dấu, điều đáng để kiểm tra thêm một lần nữa.",

  // ev.shared-case-id
  "evidence/ev.shared-case-id/title": "Cùng một mã hồ sơ ở hai nơi",
  "evidence/ev.shared-case-id/description":
    "Alex đưa mã hồ sơ NG-4471-X trong cuộc gọi đầu tiên. Thông báo cũng dùng NG-4471-X. Hai liên hệ riêng biệt đồng ý về một mã, nhưng chúng có thể có chung một nguồn. Sự trùng khớp giữa chúng không phải là xác nhận độc lập.",
  "evidence/ev.shared-case-id/location": "Máy tính xách tay, màn hình so sánh",
  "evidence/ev.shared-case-id/relations/claim.claims-independent/note":
    "Một mã dùng chung có thể có nghĩa là chỉ có một nguồn đứng sau cả hai. Hãy kiểm tra với người không phụ thuộc vào cả hai.",
  "evidence/ev.shared-case-id/relevance":
    "Cho thấy hai tin nhắn lặp lại cùng một chi tiết có thể chỉ là một nguồn, không phải hai người làm chứng.",
  "evidence/ev.shared-case-id/debriefHint":
    "Alex và thông báo dùng cùng một mã hồ sơ. Hai liên hệ khớp nhau vẫn có thể đến từ một nguồn.",

  // ev.note-app-origin
  "evidence/ev.note-app-origin/title": "Ghi chú của chính bạn về cách ngân hàng liên lạc",
  "evidence/ev.note-app-origin/description":
    "Mẩu ghi chú tự viết của bạn nói rằng ngân hàng liên lạc với bạn qua ứng dụng Northgate Mobile và số +000 0100 0800 in trên sao kê. Thông báo lại dùng một ứng dụng khác, NG Secure Helper. Đây là một manh mối yếu. Ghi chú chỉ ghi lại thói quen của bạn và không chứng minh thông báo là sai.",
  "evidence/ev.note-app-origin/location": "Mẩu ghi chú tự viết gần bàn",
  "evidence/ev.note-app-origin/relations/claim.notification-genuine/note":
    "Yếu. Thông báo không theo kênh thường lệ của bạn, nhưng chỉ có việc kiểm tra với ngân hàng mới giải quyết được.",
  "evidence/ev.note-app-origin/relevance":
    "Cho thấy một quy tắc cá nhân bạn đặt ra từ trước có thể giúp bạn nhận ra tin nhắn không khớp.",
  "evidence/ev.note-app-origin/debriefHint":
    "Ghi chú của chính bạn nói ngân hàng liên lạc với bạn thế nào, và thông báo không theo cách đó.",

  // ev.alex-statement
  "evidence/ev.alex-statement/title": "Những gì Alex đã nói, bằng văn bản",
  "evidence/ev.alex-statement/description":
    "Bản ghi cuộc gọi đầu tiên cho biết Alex đã đưa mã hồ sơ NG-4471-X, yêu cầu một mã gửi đến điện thoại của bạn, và đưa số gọi lại +000 0100 2200. Bản ghi cũng cho biết sẽ có một thông báo và một nhóm theo dõi liên lạc sau đó. Đây là lời khẳng định của người gọi, không phải điều bạn đã kiểm chứng.",
  "evidence/ev.alex-statement/location": "Điện thoại, bản ghi cuộc gọi đầu tiên",
  "evidence/ev.alex-statement/relations/claim.alex-identity/note":
    "Bản ghi cho thấy điều đã được khẳng định. Nó không cho biết lời khẳng định đó có đúng không.",
  "evidence/ev.alex-statement/relevance":
    "Một bản ghi bằng văn bản giúp dễ so sánh các lời khẳng định về sau, và nó báo trước thông báo cùng nhóm theo dõi.",
  "evidence/ev.alex-statement/debriefHint":
    "Bản ghi cuộc gọi đầu tiên nói rằng sẽ có một thông báo và một nhóm theo dõi. Cả hai đều đã đến.",

  // ev.recovery-statement
  "evidence/ev.recovery-statement/title": "Người gọi thứ ba lặp lại mã hồ sơ",
  "evidence/ev.recovery-statement/description":
    "Người gọi thứ ba lặp lại mã hồ sơ NG-4471-X và nói rằng tiền của bạn phải được chuyển sang một tài khoản tạm giữ để bảo vệ. Người gọi cũng đồng tình với những nghi ngờ của bạn. Cùng một mã bạn đã thấy hai lần là một lời khẳng định lặp lại, không phải một người làm chứng mới.",
  "evidence/ev.recovery-statement/location": "Cuộc gọi thứ ba, người gọi khôi phục",
  "evidence/ev.recovery-statement/relations/claim.recovery-needed/note":
    "Người gọi yêu cầu hành động gấp. Có cần hành động hay không là điều chỉ ngân hàng mới xác nhận được.",
  "evidence/ev.recovery-statement/relevance":
    "Cho thấy một giọng nói thứ ba có thể mượn chi tiết từ hai giọng đầu để trông như độc lập.",
  "evidence/ev.recovery-statement/debriefHint":
    "Người gọi thứ ba lặp lại cùng mã hồ sơ và yêu cầu bạn chuyển tiền.",

  // ev.official-confirmation
  "evidence/ev.official-confirmation/title": "Đường dây ngân hàng xác nhận không có hồ sơ nào như vậy",
  "evidence/ev.official-confirmation/description":
    "Bạn đã gọi +000 0100 0800, số đã lưu từ trước hôm nay. Nhân viên ngân hàng không thấy hồ sơ NG-4471-X, không thấy thông báo bảo mật nào được gửi cho bạn, và không có quy trình khôi phục nào yêu cầu bạn chuyển tiền.",
  "evidence/ev.official-confirmation/location": "Cuộc gọi đến số ngân hàng đã lưu",
  "evidence/ev.official-confirmation/relations/claim.alex-identity/note":
    "Ngân hàng không có hồ sơ nào về người gọi này hay hồ sơ này.",
  "evidence/ev.official-confirmation/relations/claim.notification-genuine/note": "Ngân hàng không gửi thông báo này.",
  "evidence/ev.official-confirmation/relations/claim.recovery-needed/note": "Không có quy trình khôi phục nào cả.",
  "evidence/ev.official-confirmation/relations/claim.claims-independent/note":
    "Các người gọi và thông báo có chung một nguồn.",
  "evidence/ev.official-confirmation/relevance":
    "Cho thấy cách xử lý đúng: dừng lại, rồi hỏi qua một kênh bạn đã tin từ trước, không phải kênh do người gửi đưa.",
  "evidence/ev.official-confirmation/debriefHint":
    "Gọi vào số bạn đã lưu từ trước hôm nay sẽ giải quyết được câu hỏi.",

  // ev.calendar-routine
  "evidence/ev.calendar-routine/title": "Không có cuộc hẹn bảo mật nào trên lịch của bạn",
  "evidence/ev.calendar-routine/description":
    "Cuốn lịch của bạn chỉ có ngày sao kê quen thuộc và không có cuộc hẹn bảo mật nào với ngân hàng. Chi tiết này không bắt buộc và yếu. Một ô trống khớp với những gì bạn nhớ, nhưng không chứng minh điều gì về các cuộc gọi.",
  "evidence/ev.calendar-routine/location": "Cuốn lịch treo tường",
  "evidence/ev.calendar-routine/relations/claim.recovery-needed/note":
    "Lịch sinh hoạt của bạn không có dấu hiệu nào về chuyện bảo mật, nhưng lịch sinh hoạt không thể loại trừ chuyện đó.",
  "evidence/ev.calendar-routine/relevance":
    "Một chi tiết không bắt buộc, cho thấy nhiều dấu hiệu yếu khác với một sự thật đã được xác nhận như thế nào.",
  "evidence/ev.calendar-routine/debriefHint":
    "Lịch của bạn không có cuộc hẹn bảo mật nào. Đó là một dấu hiệu yếu, không phải bằng chứng.",

  // ev.recovery-number-match
  "evidence/ev.recovery-number-match/title": "Người gọi thứ ba dùng số trong thông báo",
  "evidence/ev.recovery-number-match/description":
    "Chi tiết cuộc gọi thứ ba cho thấy số hiển thị là +000 0100 7771. Đó là số liên hệ mà chính thông báo đã đưa ra. Thông báo và người gọi thứ ba có thể có chung một nguồn, dù chỉ một số thì vẫn cần được kiểm tra.",
  "evidence/ev.recovery-number-match/location": "Điện thoại, chi tiết cuộc gọi thứ ba",
  "evidence/ev.recovery-number-match/relations/claim.claims-independent/note":
    "Một số dùng chung cho thấy chỉ có một nguồn. Hãy xác nhận với ngân hàng trước khi quyết định.",
  "evidence/ev.recovery-number-match/relevance":
    "Nối cuộc gọi thứ ba với thông báo, điều đã được báo trước từ trước đó.",
  "evidence/ev.recovery-number-match/debriefHint":
    "Cuộc gọi thứ ba đến từ chính số mà thông báo đã đưa ra.",
};
