// Colors of the two simulated UEH sites: the student portal (the valid site of the story) and the
// look-alike "graduation clearance" site. Dark teal and orange on white, taken from the logo the
// owner supplied. The look-alike uses the same logo (a copy would) with a slightly different teal and
// orange in the page; nothing on the site says so.

export interface SiteColors {
  teal: string;
  tealDark: string;
  tealSoft: string;
  orange: string;
  orangeSoft: string;
  ink: string;
  muted: string;
  line: string;
  page: string;
  white: string;
}

export const PORTAL_COLORS: SiteColors = {
  teal: "#005b69",
  tealDark: "#00424d",
  tealSoft: "#e3f0f2",
  orange: "#f47a38",
  orangeSoft: "#fff0e6",
  ink: "#0f2f35",
  muted: "#44666c",
  line: "#d0e1e4",
  page: "#f2f8f9",
  white: "#ffffff",
};

export const CLEARANCE_COLORS: SiteColors = {
  teal: "#0a6674",
  tealDark: "#064a55",
  tealSoft: "#e6f2f4",
  orange: "#f58545",
  orangeSoft: "#fff2e8",
  ink: "#10323a",
  muted: "#486a70",
  line: "#d3e4e7",
  page: "#f4f9fa",
  white: "#ffffff",
};

/** Initials and values the game uses to fill forms. Fictional: never a real login, card or code. */
export const GAME_PROFILE = {
  name: "Alex",
  studentId: "ALEX-0001",
  email: "alex.nguyen@st.ueh.edu.vn",
  /** Shown as dots; the password itself is never stored or typed. */
  passwordMask: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
  /** Fictional, and only ever shown masked: the browser's saved card, like Chrome shows it. */
  cardHolder: "ALEX NGUYEN",
  cardNumber: "\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 0451",
  cardLast4: "0451",
  cardBrand: "Visa",
  cardExpiry: "04/28",
  cardCvc: "\u2022\u2022\u2022",
} as const;
