import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyLocale } from "../../../i18n";
import enHud from "../../../i18n/locales/en/chapter1/hud";
import viHud from "../../../i18n/locales/vi/chapter1/hud";
import { CINE } from "../theme";
import { EvidenceNotice } from "./EvidenceNotice";

beforeEach(() => {
  applyLocale("en");
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("EvidenceNotice", () => {
  it("is a polite status region with the evidence title", () => {
    render(<EvidenceNotice title="Bank alert" />);
    const notice = screen.getByTestId("evidence-notice");
    expect(notice.getAttribute("role")).toBe("status");
    expect(notice.getAttribute("aria-live")).toBe("polite");
    expect(notice.textContent).toContain("Bank alert");
  });

  it("shows New evidence in bold, the title dim, Added to the Journal and a check icon", () => {
    applyLocale("en");
    render(<EvidenceNotice title="Bank alert" />);
    const notice = screen.getByTestId("evidence-notice");
    expect(notice.textContent).toContain("New evidence");
    expect(notice.textContent).toContain("Added to the Journal");
    expect(screen.getByText("New evidence").className).toContain("font-bold");
    expect(screen.getByTestId("evidence-notice-title").textContent).toBe("Bank alert");
    const icons = notice.querySelectorAll("svg");
    expect(icons).toHaveLength(2);
    for (const icon of icons) expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(notice.style.width).toBe(`${CINE.widthPx.toast}px`);
  });

  it("has Vietnamese text and no Vietnamese leak into English", () => {
    expect(viHud.notice.newEvidence.length).toBeGreaterThan(0);
    expect(viHud.notice.addedToJournal.length).toBeGreaterThan(0);
    expect(viHud.notice.newEvidence).not.toBe(enHud.notice.newEvidence);
    expect(viHud.objectives.doneLabel).not.toBe(enHud.objectives.doneLabel);
  });

  it("fades near the end and dismisses once after the duration", () => {
    const onDismiss = vi.fn();
    render(<EvidenceNotice title="Bank alert" onDismiss={onDismiss} />);
    const notice = screen.getByTestId("evidence-notice");
    expect(notice.getAttribute("data-leaving")).toBe("false");
    act(() => {
      vi.advanceTimersByTime(CINE.motion.toastMs - CINE.motion.baseMs + 1);
    });
    expect(notice.getAttribute("data-leaving")).toBe("true");
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(CINE.motion.baseMs);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
