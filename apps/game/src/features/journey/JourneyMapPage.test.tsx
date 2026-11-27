// The `/journey` page renders the live "LAST SUBMISSION: 72 GIỜ CUỐI" scenario, not the parked
// fixture the shared setup uses, so the two modules below keep their real implementation here.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { applyLocale } from "../../i18n";
import { getDisplayScenario } from "../../i18n/narrative";
import { JourneyMapPage } from "./JourneyMapPage";

vi.mock("../../game/narrative/activeScenario", async (importOriginal) => importOriginal());
vi.mock("../../i18n/narrative/lastSubmission.vi", async (importOriginal) => importOriginal());

describe("the journey map page", () => {
  it("lists the missions of the routed scenario", () => {
    render(<JourneyMapPage />);
    expect(screen.getByTestId("journey-page")).toBeTruthy();
    for (const mission of getDisplayScenario("en").missions ?? []) {
      expect(screen.getByTestId(`journey-mission-${mission.id}`)).toBeTruthy();
    }
    expect(screen.getByTestId("journey-mission-m01.missing-access").textContent).toContain("THE MISSING ACCESS");
    // The header repeats the chapter's own premise line for Alex.
    expect(screen.getByTestId("journey-page").textContent).toContain("You are Alex");
    expect(screen.getByTestId("journey-mission-m02.the-ride").textContent).toContain("THE RIDE");
  });

  it("shows the three planned missions as planned, with the cast registry names", () => {
    render(<JourneyMapPage />);
    for (const number of [3, 4, 5]) {
      expect(screen.getByTestId(`journey-planned-${number}`)).toBeTruthy();
    }
    expect(screen.getByTestId("journey-planned-3").textContent).toContain("MONEY AND HOUSING");
    expect(screen.getByTestId("journey-planned-3").textContent).toContain("Mr. Tuấn");
  });

  it("splits the persistent flags into written and reserved", () => {
    render(<JourneyMapPage />);
    const written = screen.getByTestId("journey-flags-written").textContent ?? "";
    const reserved = screen.getByTestId("journey-flags-reserved").textContent ?? "";
    expect(written).toContain("schoolAccessVerified");
    expect(reserved).toContain("housingDepositLost");
    expect(written).not.toContain("housingDepositLost");
  });

  it("names the code that owns each part of the journey", () => {
    render(<JourneyMapPage />);
    const map = screen.getByTestId("journey-code-map");
    expect(within(map).getByText("src/game/narrative/resources.ts")).toBeTruthy();
    expect(within(map).getByText("src/features/chapter1/room/RoomChapterLayer.tsx")).toBeTruthy();
  });

  it("returns to the menu from the header button", () => {
    const onBackToMenu = vi.fn();
    render(<JourneyMapPage onBackToMenu={onBackToMenu} />);
    fireEvent.click(screen.getByRole("button", { name: /back to menu/i }));
    expect(onBackToMenu).toHaveBeenCalledTimes(1);
  });

  it("follows the Vietnamese overlay for the mission text and the page chrome", () => {
    applyLocale("vi");
    render(<JourneyMapPage onBackToMenu={() => undefined} />);
    expect(screen.getByRole("button", { name: "Về menu" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "72 giờ" })).toBeTruthy();
    expect(screen.getByTestId("journey-mission-m02.the-ride").textContent).toContain("CHUYẾN ĐI");
    expect(screen.getByTestId("journey-mission-m01.easy-money").textContent).toContain("TIỀN DỄ KIẾM");
  });
});
