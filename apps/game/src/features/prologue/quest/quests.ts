// Quest list of the Chapter 1 prologue (the neighborhood walk). Pure TypeScript. Quest text is in
// `i18n/locales/{en,vi}/worlds/quests.ts` under `quests.<id>`.
//
// This is walk-around state kept by the prologue page. The deterministic chapter core (`game/
// narrative/`) starts with the room, so nothing here changes the story outcome.

export type QuestId = "meetMai";
export type QuestStatus = "active" | "done";

export interface QuestDefinition {
  id: QuestId;
  /** Person the quest leads to (an NPC id of the neighborhood world). */
  npc: "mai";
}

export const QUESTS: readonly QuestDefinition[] = [{ id: "meetMai", npc: "mai" }];

export interface QuestState {
  status: Readonly<Partial<Record<QuestId, QuestStatus>>>;
  /** Quest shown outside the list (the tracker); null when none. */
  tracked: QuestId | null;
  /** The list was opened since the last new quest (the red "!" on the list button). */
  seen: boolean;
}

export const questDefinition = (id: QuestId) => QUESTS.find((q) => q.id === id) as QuestDefinition;

/** At the start of the walk: the first quest is active and tracked. */
export const initialQuestState = (): QuestState => ({ status: { meetMai: "active" }, tracked: "meetMai", seen: false });

export function completeQuest(state: QuestState, id: QuestId): QuestState {
  if (state.status[id] !== "active") return state;
  const status: Partial<Record<QuestId, QuestStatus>> = { ...state.status, [id]: "done" };
  const nextActive = QUESTS.find((q) => status[q.id] === "active")?.id ?? null;
  return { ...state, status, tracked: state.tracked === id ? nextActive : state.tracked };
}

export const trackQuest = (state: QuestState, id: QuestId | null): QuestState =>
  id === null || state.status[id] === "active" ? { ...state, tracked: id } : state;

export const markSeen = (state: QuestState): QuestState => (state.seen ? state : { ...state, seen: true });

/** Quests of one status, in list order. */
export const questsWith = (state: QuestState, status: QuestStatus): QuestId[] => QUESTS.filter((q) => state.status[q.id] === status).map((q) => q.id);

/** True when the list button should show its red mark: an active quest the player has not looked at. */
export const hasNewQuest = (state: QuestState) => !state.seen && questsWith(state, "active").length > 0;
