// Evidence journal combine control, recorded deductions and hint toggle (task 9.5).
// Requirements 8.11, 15.2, 15.3 and 22.1. Driven by the fixture scenario and the real reducer.
import { fireEvent, render, screen, within } from "@testing-library/react";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { chapterReducer } from "../../../game/narrative/reducer";
import { selectClaimStatuses, selectCombinationOptions, selectJournalEntries } from "../../../game/narrative/selectors";
import type { ChapterState, CoreAction } from "../../../game/narrative/types";
import { FIXTURE_SCENARIO, fixtureState, withEvidence } from "../../../test/fixtureScenario";
import enJournalCombine from "../../../i18n/locales/en/chapter1/journalCombine";
import { EvidenceJournal } from "./EvidenceJournal";
import { relatedDeductionStatements } from "./relatedDeductions";

const T = enJournalCombine.journalCombine;
const SAME_SOURCE = "These claims are not independently verified.";

/** A journal bound to the real reducer over the fixture scenario. */
const Harness: React.FC<{
  initial: ChapterState;
  hint?: string | null;
  onDispatch?: (action: CoreAction) => void;
}> = ({ initial, hint = null, onDispatch }) => {
  const [state, setState] = useState(initial);
  return (
    <EvidenceJournal
      entries={selectJournalEntries(state, FIXTURE_SCENARIO)}
      claims={selectClaimStatuses(state, FIXTURE_SCENARIO)}
      decisionOffered={false}
      onDecide={() => undefined}
      onClose={() => undefined}
      combination={selectCombinationOptions(state, FIXTURE_SCENARIO)}
      relatedDeductions={relatedDeductionStatements(state, FIXTURE_SCENARIO)}
      hint={hint}
      onCombine={(evidenceIds) => {
        const action: CoreAction = { type: "COMBINE_EVIDENCE", evidenceIds };
        onDispatch?.(action);
        const result = chapterReducer(state, action, FIXTURE_SCENARIO);
        setState(result.state);
        return result;
      }}
    />
  );
};

const startState = () =>
  withEvidence(fixtureState(), ["ev.alex-statement", "ev.shared-case-id", "ev.notification-metadata"]);

const item = (name: RegExp) => screen.getByRole("button", { name });
const submit = () => screen.getByRole("button", { name: T.submit });

describe("EvidenceJournal combine control", () => {
  it("dispatches COMBINE_EVIDENCE once with the selected IDs and shows the recorded statement", () => {
    const onDispatch = vi.fn();
    render(<Harness initial={startState()} onDispatch={onDispatch} />);
    fireEvent.click(item(/What the first caller said/));
    fireEvent.click(item(/Case number in the notification/));
    fireEvent.click(submit());

    expect(onDispatch).toHaveBeenCalledTimes(1);
    expect(onDispatch).toHaveBeenCalledWith({
      type: "COMBINE_EVIDENCE",
      evidenceIds: ["ev.alex-statement", "ev.shared-case-id"],
    });
    expect(screen.getByTestId("combine-result").textContent).toBe(T.result.accepted);
    // The statement shows in the connections list and under both related items.
    expect(screen.getAllByText(SAME_SOURCE).length).toBeGreaterThanOrEqual(3);
  });

  it("limits the selection to three items and needs two to submit", () => {
    const state = withEvidence(startState(), ["ev.account-activity"]);
    render(<Harness initial={state} />);
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(item(/What the first caller said/));
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(item(/Case number in the notification/));
    expect((submit() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(item(/Notification sender details/));
    fireEvent.click(item(/Paper statement \(/));
    expect(screen.getByText(T.tooMany)).toBeTruthy();
    expect(item(/Paper statement \(/).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(3);
  });

  it("shows a neutral message for a rejected combination and keeps the selection", () => {
    render(<Harness initial={startState()} />);
    fireEvent.click(item(/What the first caller said/));
    fireEvent.click(item(/Notification sender details/));
    fireEvent.click(submit());
    expect(screen.getByTestId("combine-result").textContent).toBe(T.result.rejected);
    expect(item(/What the first caller said/).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText(SAME_SOURCE)).toBeNull();
  });

  it("maps already-recorded and unavailable reasons to their own neutral messages", () => {
    const onCombine = vi
      .fn()
      .mockReturnValueOnce({ accepted: false, reason: "This deduction is already recorded." })
      .mockReturnValueOnce({ accepted: false, reason: "Evidence not available yet." })
      .mockReturnValueOnce({ accepted: false, reason: "Something unexpected." });
    render(
      <EvidenceJournal
        entries={[]}
        claims={[]}
        decisionOffered={false}
        onDecide={() => undefined}
        onClose={() => undefined}
        combination={selectCombinationOptions(startState(), FIXTURE_SCENARIO)}
        onCombine={onCombine}
      />,
    );
    fireEvent.click(item(/What the first caller said/));
    fireEvent.click(item(/Case number in the notification/));
    const expected = [T.result.alreadyRecorded, T.result.notAvailable, T.result.rejected];
    for (const message of expected) {
      fireEvent.click(submit());
      expect(screen.getByTestId("combine-result").textContent).toBe(message);
    }
  });

  it("shows the hint only after the toggle is turned on", () => {
    render(<Harness initial={startState()} hint="Look at the notification." />);
    expect(screen.queryByText("Look at the notification.")).toBeNull();
    const toggle = screen.getByRole("button", { name: T.hint.show });
    fireEvent.click(toggle);
    expect(screen.getByText("Look at the notification.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: T.hint.hide }));
    expect(screen.queryByText("Look at the notification.")).toBeNull();
  });

  it("has no hint toggle and no text input when there is no hint", () => {
    render(<Harness initial={startState()} />);
    expect(screen.queryByRole("button", { name: T.hint.show })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("is keyboard operable: native buttons in reading order, focusable, no custom key handling", () => {
    // jsdom does not turn Space/Enter into clicks, so this checks what makes the browser do it:
    // every control is a native, enabled, tabbable <button type="button"> in the right order.
    render(<Harness initial={startState()} hint="Look at the notification." />);
    fireEvent.click(item(/What the first caller said/));
    fireEvent.click(item(/Case number in the notification/));
    const controls = [
      item(/What the first caller said/),
      item(/Notification sender details/),
      item(/Case number in the notification/),
      submit(),
      screen.getByRole("button", { name: T.clear }),
      screen.getByRole("button", { name: T.hint.show }),
    ];
    for (const control of controls) {
      expect(control.tagName).toBe("BUTTON");
      expect(control.getAttribute("type")).toBe("button");
      expect(control.getAttribute("tabindex")).toBeNull();
      expect((control as HTMLButtonElement).disabled).toBe(false);
      control.focus();
      expect(document.activeElement).toBe(control);
    }
    const order = Array.from(document.querySelectorAll("button"));
    expect(order.indexOf(controls[0] as HTMLButtonElement)).toBeLessThan(order.indexOf(controls[3] as HTMLButtonElement));
    expect(order.indexOf(controls[3] as HTMLButtonElement)).toBeLessThan(order.indexOf(controls[5] as HTMLButtonElement));
  });
  it("lists recorded deductions with their statement", () => {
    const state = { ...startState(), deductions: ["ded.same-source" as const] };
    render(<Harness initial={state} />);
    const section = screen.getByRole("region", { name: T.heading });
    expect(within(section).getByText(SAME_SOURCE)).toBeTruthy();
  });
});
