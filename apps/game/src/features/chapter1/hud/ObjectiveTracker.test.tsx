import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyLocale } from "../../../i18n";
import type { Objective } from "../../../game/narrative/types";
import { CINE } from "../theme";
import { OBJECTIVE_INDENT_PX, ObjectiveTracker } from "./ObjectiveTracker";

const objective = (id: string, text: string) => ({ id, text }) as unknown as Objective;

beforeEach(() => {
  applyLocale("en");
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("ObjectiveTracker idle fade", () => {
  it("dims after the idle time and wakes when the objectives change", () => {
    const first = [objective("obj.a", "Look around")];
    const { rerender } = render(<ObjectiveTracker objectives={first} />);
    const tracker = screen.getByTestId("objective-tracker");
    expect(tracker.getAttribute("data-idle")).toBe("false");
    act(() => {
      vi.advanceTimersByTime(CINE.motion.idleFadeAfterMs + 1);
    });
    expect(tracker.getAttribute("data-idle")).toBe("true");
    rerender(<ObjectiveTracker objectives={[objective("obj.b", "Check the laptop")]} />);
    expect(screen.getByTestId("objective-tracker").getAttribute("data-idle")).toBe("false");
    expect(screen.getByText("Check the laptop")).toBeTruthy();
  });

  it("keeps the objective list in a polite live region", () => {
    render(<ObjectiveTracker objectives={[objective("obj.a", "Look around")]} announcement="Done" />);
    expect(screen.getByText("Done").parentElement?.getAttribute("aria-live")).toBe("polite");
  });
});

describe("ObjectiveTracker card", () => {
  it("has a letter-spaced caps header and the quest icon before the current objective", () => {
    render(<ObjectiveTracker objectives={[objective("obj.a", "Look around")]} />);
    const heading = screen.getByRole("heading", { name: "Objective" });
    expect(heading.className).toContain("uppercase");
    expect(heading.className).toContain("tracking-");
    const current = screen.getByTestId("objective-current");
    expect(current.textContent).toBe("Look around");
    const icon = current.querySelector("img");
    expect(icon?.getAttribute("src")).toContain("scammaze-quest-icon");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("lists other active objectives smaller and indented under the current one", () => {
    render(<ObjectiveTracker objectives={[objective("obj.a", "Look around"), objective("obj.b", "Check the note")]} />);
    const other = screen.getByTestId("objective-other");
    expect(other.textContent).toBe("Check the note");
    expect(other.style.paddingLeft).toBe(`${OBJECTIVE_INDENT_PX}px`);
    expect(other.querySelector("img")).toBeNull();
  });

  it("shows a completed objective with a check mark and a screen-reader label", () => {
    render(<ObjectiveTracker objectives={[objective("obj.b", "Check the note")]} completed={[objective("obj.a", "Look around")]} />);
    const done = screen.getByTestId("objective-done");
    expect(done.querySelector("svg")).toBeTruthy();
    expect(done.textContent).toContain("Completed:");
    expect(done.textContent).toContain("Look around");
  });

  it("shows the hint as one dim sub-line only while the hint toggle is on", () => {
    const objectives = [objective("obj.a", "Look around")];
    const { rerender } = render(<ObjectiveTracker objectives={objectives} hint="Try the desk." hintOn={false} />);
    expect(screen.queryByTestId("room-hint")).toBeNull();
    rerender(<ObjectiveTracker objectives={objectives} hint="Try the desk." hintOn />);
    const hint = screen.getByTestId("room-hint");
    expect(hint.textContent).toBe("Try the desk.");
    expect(hint.getAttribute("role")).toBe("note");
    expect(hint.style.paddingLeft).toBe(`${OBJECTIVE_INDENT_PX}px`);
    rerender(<ObjectiveTracker objectives={objectives} hint={null} hintOn />);
    expect(screen.getByTestId("room-hint").textContent).toBe("No hint is available right now.");
  });
});
