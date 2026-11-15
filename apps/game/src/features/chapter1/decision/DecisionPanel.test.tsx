// Decision panel tests for the five Act V decisions and the verify pre-step.
// Spec chapter-01-double-deception, task 10.3. Requirements 10.1 and 10.10.
//
// The panel is driven by a real Chapter_Store and the real selectors, so every assertion checks the
// same data path the chapter layer uses. The harness mirrors the layer wiring: the pre-step button
// dispatches VERIFY_CLAIM and a confirmed choice dispatches MAKE_DECISION.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React, { useSyncExternalStore } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { createInitialState } from "../../../game/narrative/reducer";
import { selectDecisionPanel } from "../../../game/narrative/selectors";
import { createChapterStore, type ChapterStore } from "../../../game/narrative/store";
import type { CoreAction, ScenarioDefinition } from "../../../game/narrative/types";
import { applyLocale } from "../../../i18n";
import { getDisplayScenario } from "../../../i18n/narrative";
import enOutcome from "../../../i18n/locales/en/chapter1/outcome";
import viOutcome from "../../../i18n/locales/vi/chapter1/outcome";
import { CALL_SAVED_CONTACT, DECLINE_ALEX, FOLLOW_THE_NOTIFICATION, TRUST_THIRD_CALL } from "../../../test/chapterRuns";
import { DecisionPanel } from "./DecisionPanel";

const EN = enOutcome.decision;
const VI = viOutcome.decision;
const DECISIONS = CHAPTER_1_SCENARIO.decisions;
const PRE_STEP_LABEL = DECISIONS["verify-independently"].preStep!.label;
const START: CoreAction = { type: "START_CHAPTER" };

/** Alex declined and the third caller declined: Act V starts and the decisions are offered. */
const ACT_FIVE: CoreAction[] = [
  START,
  ...DECLINE_ALEX,
  { type: "DEVICE_ACTION", deviceActionId: "dev.dismiss-notification" },
  { type: "RING_CALL", callId: "call.recovery", reason: "follow-up" },
  { type: "END_CALL" },
];

function dispatchAll(store: ChapterStore, actions: readonly CoreAction[]): void {
  for (const action of actions) {
    let accepted = false;
    let reason: string | undefined;
    act(() => {
      const result = store.dispatch(action);
      accepted = result.accepted;
      reason = result.reason;
    });
    expect(accepted, `${JSON.stringify(action)} rejected: ${reason ?? ""}`).toBe(true);
  }
}

function storeAfter(actions: readonly CoreAction[]): ChapterStore {
  const store = createChapterStore(createInitialState());
  dispatchAll(store, actions);
  return store;
}

const Harness: React.FC<{
  store: ChapterStore;
  scenario?: ScenarioDefinition;
  onClose?: () => void;
}> = ({ store, scenario = CHAPTER_1_SCENARIO, onClose = () => undefined }) => {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return (
    <DecisionPanel
      panel={selectDecisionPanel(state, scenario)}
      onStartPreStep={(preStep) =>
        store.dispatch({ type: "VERIFY_CLAIM", claimId: preStep.claimId, method: preStep.method })
      }
      onDecide={(decision) => store.dispatch({ type: "MAKE_DECISION", decision })}
      onClose={onClose}
    />
  );
};

const dialog = () => screen.getByRole("dialog");
const button = (name: string) => within(dialog()).getByRole("button", { name });
const isDisabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;

afterEach(() => {
  act(() => {
    applyLocale("en");
  });
});

describe("DecisionPanel with a real chapter store", () => {
  it("is not offered before Act V", () => {
    const store = storeAfter([START]);
    expect(selectDecisionPanel(store.getState(), CHAPTER_1_SCENARIO).offered).toBe(false);
    render(<Harness store={store} />);
    expect(within(dialog()).getByText(EN.notOffered)).toBeTruthy();
    for (const id of Object.keys(DECISIONS) as Array<keyof typeof DECISIONS>) {
      expect(isDisabled(button(DECISIONS[id].label))).toBe(true);
    }
  });

  it("lists the five decisions; refusing is always available and the others show a hint until they are unlocked", () => {
    const store = storeAfter(ACT_FIVE);
    render(<Harness store={store} />);
    expect(Object.keys(DECISIONS)).toHaveLength(5);

    expect(isDisabled(button(DECISIONS["refuse-and-stop"].label))).toBe(false);
    for (const id of ["follow-recovery", "follow-both", "verify-independently", "report-deception"] as const) {
      expect(isDisabled(button(DECISIONS[id].label)), id).toBe(true);
    }
    expect(within(dialog()).getByText(DECISIONS["follow-recovery"].unavailableHint)).toBeTruthy();
    expect(within(dialog()).getByText(DECISIONS["report-deception"].unavailableHint)).toBeTruthy();
    // The verify option shows its hint once and is described by it.
    const verifyHint = DECISIONS["verify-independently"].preStep!.unavailableHint;
    expect(within(dialog()).getAllByText(verifyHint)).toHaveLength(1);
  });

  it("unlocks follow-recovery after the recovery steps were heard and confirms before deciding", () => {
    const store = storeAfter([START, ...DECLINE_ALEX, ...FOLLOW_THE_NOTIFICATION, ...TRUST_THIRD_CALL]);
    const dispatch = vi.spyOn(store, "dispatch");
    render(<Harness store={store} />);

    const choice = button(DECISIONS["follow-recovery"].label);
    expect(isDisabled(choice)).toBe(false);
    fireEvent.click(choice);
    const confirmHeading = within(dialog()).getByRole("heading", { name: EN.confirmHeading });
    expect(document.activeElement).toBe(confirmHeading);
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "MAKE_DECISION" }));

    fireEvent.click(button(EN.back));
    expect(store.getState().decision).toBeNull();

    fireEvent.click(button(DECISIONS["follow-recovery"].label));
    fireEvent.click(button(EN.confirm));
    expect(dispatch).toHaveBeenLastCalledWith({ type: "MAKE_DECISION", decision: "follow-recovery" });
    expect(store.getState().outcome).toBe("false-victory");
  });

  it("refuse-and-stop ends the chapter with the unfinished case", () => {
    const store = storeAfter(ACT_FIVE);
    render(<Harness store={store} />);
    fireEvent.click(button(DECISIONS["refuse-and-stop"].label));
    fireEvent.click(button(EN.confirm));
    expect(store.getState().decision).toBe("refuse-and-stop");
    expect(store.getState().outcome).toBe("unfinished-case");
  });

  it("verify-independently needs the pre-step 'Call the number on your statement' first", () => {
    const store = storeAfter(ACT_FIVE);
    const dispatch = vi.spyOn(store, "dispatch");
    render(<Harness store={store} />);

    expect(PRE_STEP_LABEL).toBe("Call the number on your statement");
    // The statement was not found yet: step 1 is blocked and so is step 2.
    expect(isDisabled(button(PRE_STEP_LABEL))).toBe(true);
    expect(isDisabled(button(DECISIONS["verify-independently"].label))).toBe(true);

    dispatchAll(store, [CALL_SAVED_CONTACT[0]]);
    expect(isDisabled(button(PRE_STEP_LABEL))).toBe(false);
    expect(isDisabled(button(DECISIONS["verify-independently"].label))).toBe(true);

    fireEvent.click(button(PRE_STEP_LABEL));
    expect(dispatch).toHaveBeenCalledWith({
      type: "VERIFY_CLAIM",
      claimId: "claim.alex-identity",
      method: "saved-official-contact",
    });
    expect(store.getState().call.current).toBe("call.official");
    // While the call runs nothing can be decided.
    expect(isDisabled(button(DECISIONS["verify-independently"].label))).toBe(true);

    dispatchAll(store, CALL_SAVED_CONTACT.slice(2));
    expect(store.getState().call.current).toBeNull();
    expect(within(dialog()).getByText(EN.stepDone)).toBeTruthy();
    expect(within(dialog()).queryByRole("button", { name: PRE_STEP_LABEL })).toBeNull();
    expect(isDisabled(button(DECISIONS["verify-independently"].label))).toBe(false);

    fireEvent.click(button(DECISIONS["verify-independently"].label));
    fireEvent.click(button(EN.confirm));
    expect(store.getState().outcome).toBe("break-the-chain");
  });

  it("report-deception unlocks only after the first two sources are linked", () => {
    const store = storeAfter(ACT_FIVE);
    render(<Harness store={store} />);
    expect(isDisabled(button(DECISIONS["report-deception"].label))).toBe(true);
    dispatchAll(store, [
      { type: "DEVICE_ACTION", deviceActionId: "dev.open-alex-record" },
      { type: "DEVICE_ACTION", deviceActionId: "dev.open-notification" },
      { type: "DEVICE_ACTION", deviceActionId: "dev.inspect-notification-origin" },
      { type: "DEVICE_ACTION", deviceActionId: "dev.compare-case-ref" },
      { type: "COMBINE_EVIDENCE", evidenceIds: ["ev.alex-statement", "ev.notification-metadata", "ev.shared-case-id"] },
    ]);
    expect(isDisabled(button(DECISIONS["report-deception"].label))).toBe(false);
  });

  it("Close calls onClose", () => {
    const onClose = vi.fn();
    render(<Harness store={storeAfter(ACT_FIVE)} onClose={onClose} />);
    fireEvent.click(button(EN.close));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("DecisionPanel in Vietnamese", () => {
  it("shows Vietnamese panel text and never says 'an toàn'", () => {
    act(() => {
      applyLocale("vi");
    });
    const scenario = getDisplayScenario("vi");
    render(<Harness store={storeAfter(ACT_FIVE)} scenario={scenario} />);

    expect(screen.getByRole("dialog", { name: VI.heading })).toBeTruthy();
    expect(within(dialog()).getByText(VI.intro)).toBeTruthy();
    expect(within(dialog()).getByText(VI.stepOne)).toBeTruthy();
    expect(within(dialog()).getByText(VI.stepTwo)).toBeTruthy();
    expect(within(dialog()).getByRole("button", { name: VI.close })).toBeTruthy();
    expect(within(dialog()).queryByText(EN.heading)).toBeNull();
    expect(dialog().textContent ?? "").not.toMatch(/(^|[^\p{L}])an toàn/iu);
  });
});
