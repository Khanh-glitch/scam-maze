# Accessibility

Scams target everyone, including people who use a keyboard, a screen reader, a
small phone or reduced motion. SCAMMAZE aims to be usable by all of them.

## Our target

We aim for **[WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA** on the landing
page and on every playable scenario. This is a goal, not a certified claim: the
site has **not yet been formally audited**.

## What is in place today

- Semantic landmarks (`header`, `nav`, `main`, `footer`) and one `h1` per page.
- Page language declared (`lang="en"`).
- Visible keyboard focus ring on every interactive element, except the call buttons (owner design choice, see the Chapter 1 section).
- All game choices and the URL checker are native `button` / `input` elements,
  usable with keyboard only.
- Results of the game and of the URL checker are announced through
  `aria-live` regions.
- A "skip to main content" link is the first focusable element.
- The URL input has a visible label.
- No emoji or icon fonts; list markers are decorative shapes hidden from
  assistive technology (`aria-hidden`).
- Text color pairs are chosen for at least 4.5:1 contrast (calculated from the
  design tokens in `src/index.css`, not yet measured on the live site).
- No decorative animation; smooth scrolling and transitions are disabled when
  the user prefers reduced motion.
- Status is never shown by color alone: each warning also has text.
- Responsive layout from small phones to desktop.

## Chapter 1 voice, captions and comfort settings

These features belong to the game (`apps/game`). They are set in the Settings
modal, under "Voice and comfort", and stored with the other settings. Voice,
captions and sound never change the game state, the evidence, the decisions or
the outcome. The chapter is fully playable with sound off.

- **Captions (subtitles).** Every spoken caller line is also shown as text in
  the subtitle overlay (`CallSubtitleOverlay`). The overlay sits outside the
  phone, on the game screen; the phone itself shows no sentences. The
  "Captions" setting is on by default. If you turn it off, the caption still
  appears whenever the line is not audible (muted, sound off, volume 0, blocked
  by the browser, or no audio for that line), so no line is ever silent and
  invisible. The overlay shows one caller line at a time. A long line scrolls
  inside the overlay and is never cut. The caption and the notices are in
  polite `aria-live` regions that stay mounted, so the same line is not
  announced twice. The overlay is not focusable and does not take pointer
  events, so it never blocks the phone or the reply buttons. The caption fades
  in over 150 ms; with reduced motion there is no fade.
- **Mute.** The phone screen has a Mute / Unmute button. It is a real button
  with `aria-pressed` and a text label that changes with the state. Mute applies
  to the call voice only, and it is reset to "not muted" when a new call starts.
  Master sound, sound volume and voice volume are separate settings.
- **Speaker.** The phone screen has a Speaker toggle (`aria-pressed`). It turns
  the phone-speaker sound effect on or off for the current call only. It does
  not route audio to another device and does not make the voice louder. A
  change applies from the next line or from Replay, not to a line that is
  already playing. It never changes the saved "Phone speaker effect" setting,
  and it goes back to the saved setting when the next call starts.
- **Replay.** The phone screen has a Replay button that plays the current line
  again. Its visible label is "Replay" and its accessible name is "Replay last
  line". It is disabled when there is nothing to play (sound off, volume 0, or
  no clip and no preview voice).
- **Call buttons and names.** While a call is active, the keyboard order is
  Mute, Speaker, Replay, End call, then the reply options. While the phone
  rings, the order is Decline, then Accept. The visible label of each button is
  contained in its accessible name. End call and Decline are red (`#c93c47`)
  with white text, a contrast of about 4.98:1 (calculated from the colors, not
  measured on a screen); the hover color is `#b3343e`. The state of Mute and
  Speaker is not shown by color alone: `aria-pressed` is set, and Mute also
  changes its icon and label.
- **Notices.** A short text notice explains when sound is blocked by the
  browser, when a line is a development preview voice (not a recording), when a
  line is spoken in English while the caption is in Vietnamese, and when a line
  has no audio. Notices are in a polite `aria-live` region.
- **Reduced-stress mode.** Off by default. When on, the ringtone and the tension
  sound are quieter, and tense lines (impatient and pressuring tones) get a
  longer pause before them. The story does not change. In the code, this setting
  affects sound and pauses only; it does not change motion (use "Reduce motion"
  for that).
- **Reduce motion: Follow the system / On / Off.** "Follow the system" (the
  default) uses the operating system "reduce motion" setting. "On" always
  reduces motion. "Off" never reduces motion, even if the system asks for it.
  For the 3D phone call, reduced motion removes the slide-in and the ringing
  vibration. On the call screen it also removes the 150 ms caption fade and the
  ringing wobble of the avatar.
- **Keyboard flow for a call.** The call is a modal dialog. Focus starts on
  "Accept" while the phone rings, on the first reply while replies are shown,
  and on "End call" when there are no replies. Tab moves between the call
  buttons. Arrow Down and Arrow Up move between replies and wrap around. Home
  and End jump to the first and last reply. Keys 1 to 9 choose the reply at that
  position (they are ignored with Alt, Ctrl or Meta, while typing in a field,
  while the game is paused, and while replies are held back). Escape does not
  close an active call; use "End call".
- **Choice gate ("Show replies now").** On some lines the replies appear only
  after the caller has finished speaking, so you can listen first. The gate is
  only used while the voice is audible. While it waits, a status message says
  "Listening to the caller." and the "Show replies now" button is the focused
  element, so keyboard users can skip the wait at once. Activating it shows the
  replies and moves focus to the first reply. The wait also ends by itself a
  short time after the clip ends, after the clip length plus 1.5 seconds, or at
  once if the audio is muted, blocked, missing or failed. Playback ending never
  chooses a reply for you.

### Not verified for the voice features

Automated tests cover the logic of these features. They do not prove the
following, and no one has checked them yet:

- Screen reader behavior (NVDA, VoiceOver, TalkBack). The `aria-live` regions,
  the dialog focus handling and the "Show replies now" focus moves have not
  been tested with a screen reader, so we do not know how often or how clearly
  they are announced.
- Sound quality: loudness balance, how clear the voices are, the phone speaker
  effect, the ringtone and the tension sound.
- Playback of the MP3 voice clips in real browsers, including autoplay rules on
  each browser and device.
- Known gap: on the 2D fallback phone screen, the ringing avatar wobble follows
  the operating system "reduce motion" setting only, not the in-game "Reduce
  motion" setting. Choose "On" in the game and also check your system setting if
  you want to avoid it there.
- Design choice (owner decision, 2026-11-15): the call buttons (Decline, Accept, End call) draw no
  focus ring. Accept takes focus when a call rings, and the ring looked wrong on the phone glass.
  They stay reachable and usable with the keyboard (Tab, Enter, Space).
- The Settings text for reduced-stress mode mentions "no ring vibration". The
  code that turns off the 3D ring vibration is controlled by "Reduce motion",
  not by reduced-stress mode.

## Chapter 1 in the room: laptop, phone records, journal and ending

Chapter 1 now takes place in the player's room (Room v2). The layer that holds the chapter
overlays is `features/chapter1/room/RoomChapterLayer.tsx`. As with the call features above, none
of this changes game state, and the chapter does not depend on sound.

- **Laptop overlay.** It is a modal dialog (`role="dialog"`, `aria-modal="true"`, with an
  accessible name) with tabs for the notification, the bank app, the compare view and the Review
  Security page. When it opens, focus moves to its heading; when it closes, focus returns to
  where it was. Tab and Shift+Tab stay inside the open dialog. It has no text inputs, forms or
  links: addresses, case references and phone numbers are plain text, so nothing can be followed
  by mistake and there is nothing to type.
- **Phone records overlay.** It shows call history, messages and voicemail while no call is
  active, and call details that can reveal a clue. It is part of the overlay stack, so Escape and
  the Tab trap of the layer apply to it.
- **Journal.** The evidence journal is a modal dialog. Combining clues is done by selecting
  existing evidence items, without typing. A short status line (`role="status"`) says when too
  many items are selected.
- **Decision and confirmation.** The final decision panel is a modal dialog. Each choice has a
  confirmation step before it is recorded.
- **Escape.** One press closes the topmost overlay only. Escape does not close an active or
  ringing call, the ending screen or the debrief. When no overlay is open, Escape opens the pause
  menu.
- **Live region.** A polite, visually hidden live region (`role="status"`, `aria-live="polite"`)
  announces a new notification, a new clue and a recorded conclusion. The ending narration is
  also a polite live region. These regions stay mounted so a line is not announced twice.
- **Subtitles outside the phone.** Call lines are shown in the subtitle overlay on the game
  screen, not on the phone (see "Captions" above). Narration lines of the ending are shown as
  text while they are spoken.
- **Reduced motion.** With reduced motion on (system setting or the in-game setting), the 3D
  phone does not vibrate while ringing, the ending screen appears without a fade, and the call
  caption does not fade. The 3D phone overlay is optional: when WebGL or the model is not
  available, the same call screen is shown on a 2D phone.
- **Not by color alone.** Clues the player missed are marked with the text label "Missed" in the
  debrief, not only with color or an icon.

### Not verified for the room chapter

- Screen reader behavior of the laptop, phone and journal dialogs and of the live regions (NVDA,
  VoiceOver, TalkBack) has not been tested.
- Keyboard Tab order was tested from the DOM order in automated tests, not with real key presses
  in a browser. Escape and overlay handling was checked only in jsdom.
- Focus behavior on the 3D room itself (pointer lock and the return from an overlay) has not
  been checked in a browser.
- Contrast of the new overlays was not measured on a screen.
- The Vietnamese text of these overlays has had no native-speaker review.
## Supported environments

Tested goal: recent versions of Chrome, Edge, Firefox and Safari on desktop,
and Chrome on Android / Safari on iOS.

## Known limitations

- No automated audit (axe, Lighthouse) or screen-reader testing (NVDA,
  VoiceOver, TalkBack) has been run yet.
- The landing page is English only. The game interface is available in English
  and Vietnamese.

## Report a barrier

If something blocks you, please
[open an issue with the `accessibility` label](https://github.com/teehihi/scam-maze/issues/new?labels=accessibility&template=bug_report.yml).
Tell us the page, what you tried, your browser and any assistive technology.
We treat accessibility barriers as bugs, not feature requests.
