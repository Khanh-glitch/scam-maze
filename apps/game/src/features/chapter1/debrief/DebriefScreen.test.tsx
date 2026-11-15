// Ending transition and debrief tests for the double-deception chapter.
// Spec chapter-01-double-deception, task 10.3. Requirements 10.10, 16.1, 16.2, 16.3 and 16.5.
//
// Each run is a guided script from `test/chapterRuns.ts` through the real reducer. The view comes
// from `buildDebrief`, and the real EndingTransition and DebriefScreen render it. Expected text
// comes from Scenario_Data.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDebrief, type DebriefView } from "../../../game/narrative/debrief";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import type { ScenarioDefinition } from "../../../game/narrative/types";
import { applyLocale } from "../../../i18n";
import { getDisplayScenario } from "../../../i18n/narrative";
import enDebrief from "../../../i18n/locales/en/chapter1/debriefForensic";
import enOutcome from "../../../i18n/locales/en/chapter1/outcome";
import viDebrief from "../../../i18n/locales/vi/chapter1/debriefForensic";
import viOutcome from "../../../i18n/locales/vi/chapter1/outcome";
import {
  reachEndingA,
  reachEndingB,
  reachEndingC,
  reachEndingD,
  type GuidedCompletion,
} from "../../../test/chapterRuns";
import { EndingTransition, type EndingTransitionAftermath } from "../ending/EndingTransition";
import { DebriefScreen } from "./DebriefScreen";

const EN = enOutcome.debrief;
const EN_F = enDebrief.debriefForensic;

function viewOf(run: GuidedCompletion, scenario: ScenarioDefinition = CHAPTER_1_SCENARIO): DebriefView {
  const view = buildDebrief(run.final, scenario);
  expect(view).not.toBeNull();
  return view as DebriefView;
}

function aftermathOf(view: DebriefView, scenario: ScenarioDefinition = CHAPTER_1_SCENARIO): EndingTransitionAftermath {
  const { consequence, phone, laptop, evidenceSummary } = scenario.endings[view.outcome.id].aftermath;
  return { consequence, phone, laptop, evidenceSummary };
}

function renderDebrief(view: DebriefView, caseReport?: string) {
  const onReplay = vi.fn();
  const onReturnToMenu = vi.fn();
  render(<DebriefScreen view={view} caseReport={caseReport} onReplay={onReplay} onReturnToMenu={onReturnToMenu} />);
  return { screenEl: screen.getByTestId("debrief-screen"), onReplay, onReturnToMenu };
}

function sectionOf(container: HTMLElement, headingText: string): HTMLElement {
  return within(container).getByRole("heading", { name: headingText }).closest("section") as HTMLElement;
}

/** Never call anything "safe" (safety.md). */
function expectNoSafeWord(element: HTMLElement): void {
  expect(element.textContent ?? "").not.toMatch(/\bsafe\b/i);
}

function expectNoSafeWordVi(element: HTMLElement): void {
  expect(element.textContent ?? "").not.toMatch(/(^|[^\p{L}])an toàn/iu);
}

afterEach(() => {
  act(() => {
    applyLocale("en");
  });
});

describe("EndingTransition aftermath for the four endings", () => {
  const RUNS = [
    ["false-victory", () => reachEndingA()],
    ["perfect-chain", () => reachEndingB()],
    ["break-the-chain", () => reachEndingC()],
    ["unfinished-case", () => reachEndingD()],
  ] as const;

  it.each(RUNS)("%s shows its own phone text, laptop text, evidence summary and consequence", (outcomeId, run) => {
    const view = viewOf(run());
    expect(view.outcome.id).toBe(outcomeId);
    const aftermath = aftermathOf(view);
    const onContinue = vi.fn();
    render(<EndingTransition outcome={view.outcome} aftermath={aftermath} onContinue={onContinue} />);
    const ending = screen.getByTestId("ending-transition");

    expect(ending.getAttribute("data-outcome")).toBe(outcomeId);
    expect(within(ending).getByRole("heading", { name: view.outcome.title })).toBeTruthy();
    expect(within(ending).getByText(aftermath.phone)).toBeTruthy();
    expect(within(ending).getByText(aftermath.laptop)).toBeTruthy();
    expect(within(ending).getByText(aftermath.evidenceSummary)).toBeTruthy();
    expect(within(ending).getByTestId("ending-aftermath-consequence").textContent).toBe(aftermath.consequence);
    expect(within(ending).getByText(view.outcome.simulationLabel)).toBeTruthy();
    expectNoSafeWord(ending);

    fireEvent.click(within(ending).getByRole("button", { name: enOutcome.ending.continue }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("the four endings have different aftermath text", () => {
    const views = RUNS.map(([, run]) => viewOf(run()));
    for (const field of ["consequence", "phone", "laptop", "evidenceSummary"] as const) {
      const texts = views.map((view) => aftermathOf(view)[field]);
      expect(new Set(texts).size, field).toBe(4);
    }
  });

  it("shows the current narration line and advances with the button", () => {
    const view = viewOf(reachEndingD());
    const onAdvance = vi.fn();
    render(
      <EndingTransition
        outcome={view.outcome}
        aftermath={aftermathOf(view)}
        narration={{ speakerName: "Narrator", text: "First closing line.", visible: true, finished: false, onAdvance }}
        onContinue={() => undefined}
      />,
    );
    const narration = screen.getByTestId("ending-narration");
    expect(within(narration).getByText("First closing line.")).toBeTruthy();
    fireEvent.click(within(narration).getByRole("button", { name: EN_F.ending.next }));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});

describe("DebriefScreen", () => {
  it("shows the timeline in log order with one entry per tagged action", () => {
    const view = viewOf(reachEndingA());
    const { screenEl } = renderDebrief(view);
    expect(view.timeline.length).toBeGreaterThan(2);

    const list = within(screenEl).getByTestId("debrief-timeline");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(view.timeline.length);
    const seqs = items.map((item) => Number(item.getAttribute("data-seq")));
    expect(seqs).toEqual(view.timeline.map((entry) => entry.seq));
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    items.forEach((item, index) => {
      expect(item.getAttribute("data-kind")).toBe(view.timeline[index].kind);
      expect(item.textContent).toContain(`${index + 1}.`);
    });
    // The last entry of a run that ends with a decision is that decision.
    expect(view.timeline[view.timeline.length - 1].kind).toBe("decision");
  });

  it("shows the trust analysis from the scenario", () => {
    const view = viewOf(reachEndingA());
    const { screenEl } = renderDebrief(view);
    const analysis = within(screenEl).getByTestId("debrief-analysis");
    expect(within(analysis).getByText(view.analysis.pressureBuilt)).toBeTruthy();
    expect(within(analysis).getByText(view.analysis.whyWarningLooked)).toBeTruthy();
    expect(within(analysis).getByText(view.analysis.thirdCallerNote as string)).toBeTruthy();
    expect(within(analysis).getByText(view.analysis.trapNote)).toBeTruthy();
    expect(within(analysis).getByText(EN_F.analysis.thirdCallerNotIndependent)).toBeTruthy();
    for (const line of view.analysis.verifyNextTime) expect(within(analysis).getByText(line)).toBeTruthy();
    expectNoSafeWord(screenEl);
  });

  it("separates found clues from clearly marked missed clues", () => {
    const view = viewOf(reachEndingD());
    const { screenEl } = renderDebrief(view);
    expect(view.cluesMissed.length).toBeGreaterThan(0);

    const missed = sectionOf(screenEl, EN.cluesMissed);
    // The missed clues sit in a closed disclosure whose summary shows the count.
    const details = within(missed).getByTestId("debrief-clues-missed-details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(within(missed).getByTestId("debrief-clues-missed-summary").textContent).toBe(
      EN_F.cluesMissed.summary_other.replace("{{number}}", String(view.cluesMissed.length)),
    );
    const missedItems = within(missed).getAllByRole("listitem");
    expect(missedItems).toHaveLength(view.cluesMissed.length);
    view.cluesMissed.forEach((clue, index) => {
      expect(missedItems[index].textContent).toContain(clue.title);
      expect(missedItems[index].textContent).toContain(clue.hint);
      expect(within(missedItems[index]).getByTestId("clue-missed-label").textContent).toBe(EN_F.cluesMissed.missedLabel);
    });

    const found = sectionOf(screenEl, EN.evidenceFound);
    const foundTexts = within(found)
      .queryAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    expect(foundTexts).toEqual(view.evidenceFound.map((item) => item.title));
    // A found clue is never listed as missed, and a missed clue is never listed as found.
    const foundIds = new Set(view.evidenceFound.map((item) => item.id));
    for (const clue of view.cluesMissed) expect(foundIds.has(clue.id)).toBe(false);
    expect(within(found).queryByTestId("clue-missed-label")).toBeNull();
  });

  it("reads the Missed badge and the clue title as one phrase (P2-7)", () => {
    const view = viewOf(reachEndingD());
    const { screenEl } = renderDebrief(view);
    const first = within(screenEl).getAllByTestId("clue-missed-label")[0].parentElement as HTMLElement;
    expect(first.textContent).toBe(`${EN_F.cluesMissed.missedLabel}: ${view.cluesMissed[0].title}`);
  });

  it("shows one outcome paragraph and no separate key-decisions list (P2-5)", () => {
    for (const run of [reachEndingA(), reachEndingB(), reachEndingC(), reachEndingD()]) {
      const view = viewOf(run);
      const { screenEl } = renderDebrief(view);
      const outcome = sectionOf(screenEl, EN.outcome);
      expect(within(outcome).getAllByText(/./, { selector: "p" })).toHaveLength(1);
      expect(within(outcome).getByTestId("debrief-outcome-text").textContent).toBe(view.outcome.summary);
      expect(within(screenEl).queryByRole("heading", { name: EN.decisions })).toBeNull();
      // Every timeline sentence appears once on the screen.
      for (const entry of view.timeline) {
        const count = (screenEl.textContent ?? "").split(entry.text).length - 1;
        const sameText = view.timeline.filter((other) => other.text === entry.text).length;
        expect(count, entry.text).toBe(sameText);
      }
      document.body.innerHTML = "";
    }
  });

  it("talks about the third caller only when the player answered that call (P2-6)", () => {
    const answered = renderDebrief(viewOf(reachEndingA()));
    expect(within(answered.screenEl).getByTestId("debrief-third-caller")).toBeTruthy();
    document.body.innerHTML = "";

    const declined = viewOf(reachEndingD());
    expect(declined.analysis.thirdCallerEncountered).toBe(false);
    const { screenEl } = renderDebrief(declined);
    expect(within(screenEl).queryByTestId("debrief-third-caller")).toBeNull();
    const analysis = within(screenEl).getByTestId("debrief-analysis");
    expect(analysis.textContent).not.toContain(EN_F.analysis.thirdCallerNotIndependent);
    expect(analysis.textContent).not.toContain(EN_F.analysis.thirdCaller);
    expect(analysis.textContent).not.toMatch(/third caller/i);
  });

  it("shows the case report only in the secret variant", () => {
    const secretRun = reachEndingC({ caseReport: true });
    const secretView = viewOf(secretRun);
    expect(secretView.outcome.consequence?.id).toBe("case-report");
    const caseReport = CHAPTER_1_SCENARIO.endings["break-the-chain"].aftermath.caseReport;
    const secret = renderDebrief(secretView, caseReport);
    expect(within(secret.screenEl).getByTestId("debrief-case-report").textContent).toBe(caseReport);
    expect(within(secret.screenEl).getByRole("heading", { name: EN_F.caseReport.heading })).toBeTruthy();
    document.body.innerHTML = "";

    const plainView = viewOf(reachEndingC());
    expect(plainView.outcome.consequence?.id).not.toBe("case-report");
    const plain = renderDebrief(plainView, caseReport);
    expect(within(plain.screenEl).queryByTestId("debrief-case-report")).toBeNull();
    expect(within(plain.screenEl).queryByRole("heading", { name: EN_F.caseReport.heading })).toBeNull();
  });

  it("Replay and Return to menu call their callbacks", () => {
    const { screenEl, onReplay, onReturnToMenu } = renderDebrief(viewOf(reachEndingD()));
    fireEvent.click(within(screenEl).getByRole("button", { name: EN.replay }));
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onReturnToMenu).not.toHaveBeenCalled();
    fireEvent.click(within(screenEl).getByRole("button", { name: EN.returnToMenu }));
    expect(onReturnToMenu).toHaveBeenCalledTimes(1);
  });
});

describe("DebriefScreen in Vietnamese", () => {
  it("shows Vietnamese headings for the new sections and keeps the outcome and timeline structure", () => {
    act(() => {
      applyLocale("vi");
    });
    const vi_ = getDisplayScenario("vi");
    const english = viewOf(reachEndingC({ caseReport: true }));
    const vietnamese = viewOf(reachEndingC({ caseReport: true }), vi_);
    expect(vietnamese.outcome.id).toBe(english.outcome.id);
    expect(vietnamese.timeline.map((entry) => [entry.seq, entry.kind, entry.tag])).toEqual(
      english.timeline.map((entry) => [entry.seq, entry.kind, entry.tag]),
    );

    const { screenEl } = renderDebrief(vietnamese, vi_.endings["break-the-chain"].aftermath.caseReport);
    const F = viDebrief.debriefForensic;
    for (const heading of [
      F.timeline.heading,
      F.analysis.heading,
      F.caseReport.heading,
      viOutcome.debrief.evidenceFound,
      viOutcome.debrief.cluesMissed,
    ]) {
      expect(within(screenEl).getByRole("heading", { name: heading })).toBeTruthy();
    }
    expect(within(screenEl).getByRole("button", { name: viOutcome.debrief.replay })).toBeTruthy();
    expect(within(screenEl).queryByRole("heading", { name: EN_F.timeline.heading })).toBeNull();
    expectNoSafeWordVi(screenEl);
  });
});
