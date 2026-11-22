import { describe, expect, it } from "vitest";
import { hostOf, isWebPageItem, linksOf, mailFolders, mailPreview, messagesIn, MAIL_ALL, parseSender, splitBody, unreadCount } from "./mailModel";

describe("parseSender", () => {
  it("reads the name and the address of 'Name <address>'", () => {
    expect(parseSender("Graduation Office <clearance@payment-ueh.vn>")).toEqual({
      name: "Graduation Office",
      address: "clearance@payment-ueh.vn",
      domain: "payment-ueh.vn",
      initials: "GO",
    });
  });

  it("handles an address alone, a name alone and nothing", () => {
    expect(parseSender("a.b@Example.TEST")).toMatchObject({ name: "a.b", address: "a.b@Example.TEST", domain: "example.test" });
    expect(parseSender("Payment page")).toMatchObject({ name: "Payment page", address: null, domain: null, initials: "PP" });
    expect(parseSender(null)).toMatchObject({ name: "", address: null, initials: "?" });
  });

  it("keeps the displayed name apart from the real address, so a mismatch stays visible", () => {
    const sender = parseSender('"Northgate Bank" <help@mail-check.example>');
    expect(sender.name).toBe("Northgate Bank");
    expect(sender.domain).toBe("mail-check.example");
  });
});

describe("mailPreview", () => {
  it("skips a short greeting line and joins the rest", () => {
    expect(mailPreview("Dear student,\n\nYour account is locked.\n\nFee: 1 VND")).toBe("Your account is locked. Fee: 1 VND");
  });

  it("cuts long text with an ellipsis", () => {
    const preview = mailPreview("word ".repeat(60), 40);
    expect(preview.length).toBe(40);
    expect(preview.endsWith("\u2026")).toBe(true);
  });

  it("keeps a body that is only one line", () => {
    expect(mailPreview("Hello")).toBe("Hello");
  });
});

describe("splitBody and links", () => {
  const body = "Pay now: https://payment-ueh.vn/confirm\n\nIf not, wait (see https://a.example/x).";

  it("splits plain text from addresses and drops trailing punctuation", () => {
    const segments = splitBody(body);
    expect(segments.filter((segment) => segment.kind === "link")).toEqual([
      { kind: "link", url: "https://payment-ueh.vn/confirm" },
      { kind: "link", url: "https://a.example/x" },
    ]);
    expect(segments.map((segment) => (segment.kind === "text" ? segment.text : segment.url)).join("")).toBe(body);
  });

  it("returns one text segment when there is no address", () => {
    expect(splitBody("No links.")).toEqual([{ kind: "text", text: "No links." }]);
    expect(linksOf("No links.")).toEqual([]);
  });

  it("reads the host of an address", () => {
    expect(hostOf("https://Pay.Example/confirm?x=1")).toBe("pay.example");
    expect(hostOf("not a link")).toBeNull();
  });
});

describe("folders and counts", () => {
  const messages = [
    { id: "mail.a", folder: "university", read: false, tracksUnread: true },
    { id: "mail.b", folder: "other", read: true, tracksUnread: true },
    { id: "page.c", folder: "other", read: false, tracksUnread: true },
  ];

  it("lists the folders that hold mail and filters by folder", () => {
    expect(mailFolders(messages)).toEqual(["university", "other"]);
    expect(messagesIn(messages as never, MAIL_ALL)).toHaveLength(3);
    expect(messagesIn(messages as never, "university").map((m) => m.id)).toEqual(["mail.a"]);
  });

  it("counts unread messages and marks web pages by the page. prefix", () => {
    expect(unreadCount(messages)).toBe(2);
    expect(isWebPageItem({ id: "page.fee" })).toBe(true);
    expect(isWebPageItem({ id: "mail.clearance" })).toBe(false);
  });
});
