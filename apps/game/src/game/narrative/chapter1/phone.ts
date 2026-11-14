// Placeholder (task 2.1): rewritten by task 4.1. The previous street chapter content lives in
// legacy/urgent-call-street/narrative/chapter1/.

import type { CallDef, PhoneContent } from "../types";
import type { CallId, MessageId } from "./ids";

export const CHAPTER_1_PHONE: PhoneContent = {
  messages: {} as Record<MessageId, PhoneContent["messages"][MessageId]>,
  contacts: [],
  officialWebsite: "",
  bankApp: { title: "", screens: [] },
};

export const CHAPTER_1_CALLS = {} as Record<CallId, CallDef>;
