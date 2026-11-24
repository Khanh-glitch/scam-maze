# Mission 02 — The Last Interview: the build plan

**Status:** `PROPOSED` (v2, deep research). **Branch:** `arena/f8bcde55-scam-maze`.
**What v1 was:** a correct but shallow plan — it listed what the repository contains and what to add.
**What v2 is:** the same task, grounded in how the scam actually runs in Vietnam in 2026, in how
Rockstar solves the exact problem this mission has, and in the source code of two games that are
smaller than GTA and braver than it. v1's units survive; three of them are rewritten, four are new,
and one premise of v1 was wrong (§1, R14).

> Read this as the working document. Nothing in it is claimed from memory: every repository fact
> cites a line, every world fact cites a published source, and every overturned assumption is
> recorded rather than deleted (§8, §9).

---

## 0. The one-sentence goal

**By the end of this task, a player can wake up on Wednesday, get a backup drive, and still reach —
or fail to reach — Cô Ba in District 5 by 11:30, and the two outcomes differ in what the chapter
remembers, not in whether the chapter restarts.**

Everything below serves that sentence. Anything that does not serve it is out of scope.

### What "done" means (the only definition that counts)

A person who has never read this plan plays from Tuesday 17:00 to Wednesday 14:30 and can answer
these five questions afterwards, from memory, without opening a journal:

1. What was in my hand when I left the room?
2. How did I get to District 5, and what did it cost me?
3. Did I get there on time — and if not, why not?
4. What did Cô Ba tell me, or why would she not?
5. What do I have now that I did not have this morning?

If any answer is "the game told me", the work unit that owns it is not finished.

**Added in v2, after the research.** A sixth question, for the part of the mission that is about
being manipulated rather than about being somewhere:

6. **Which of my own decisions came back to me later that day — and did I recognise it as mine?**

That question is the difference between a mission that *depicts* a scam and a mission that *models*
one. It is the whole of §1b.5 in one sentence, and it is what W9 and W10 exist to make answerable.

---

## 1. What research already established (verified in this repository)

These are facts read from the code on branch `arena/f8bcde55-scam-maze`, not from the brief. They
change the plan, so they come first.

| # | Fact | Where | Consequence for this plan |
| --- | --- | --- | --- |
| R1 | **The unverified driver already exists, fully written and staged.** `unverified_driver`, `missions: [2]`, anchor at the Bus 06 stop (`x=3.25, z=7.6`), `propKind: "helmet"`, beside a parked Super Cub. Dialogue badge is literally `"M02 · THE RIDE"`. He offers 60,000đ cash, claims the bus wait is *"forty minutes"*, and claims the app costs *"105k"* — **two figures that contradict the data, both corrected in W0** (§1b.3). | `storyCast.ts:211-235`, `storyCast.ts:772-800` | The tempting choice is **half-built and mispriced**. It cannot write state, so taking his offer does nothing. **W0** corrects the numbers, **W3** makes it land. |
| R2 | **Cô Ba exists but has no body.** `interviewee_q5`, `missions: [2]`, schedule 960–1260, but `worldAnchor` is absent and `inOpenWorld: false`. | `storyCast.ts:298-313` | She is filtered out of `OPEN_WORLD_STORY_NPCS` (`storyCast.ts:372-374`), so she is unreachable in the 3D world. **W5**. |
| R3 | **Minh already briefs the player on the ride.** `minh_m02_route` and `minh_m02_coba` fire once `draftFinished`. | `storyCast.ts:469-505` | The preparation beat exists. Do not duplicate it; **attach** to it. |
| R4 | **There is no ride app.** No device item anywhere mentions booking a ride; the 105,000đ app exists only in the driver's and Minh's dialogue. | `grep "ride\|đặt xe"` over `chapter1/*.ts` → empty | The third option is not actionable. **W2**. |
| R5 | **`backupSecured` is a declared flag that nothing ever sets.** Declared in `resources.ts:37`, defaulted at `:141`, read by the Files app at `device.ts:302` — and set by no effect in `chapter1/`. | `resources.ts`, `device.ts` | The drive the brief calls for does not exist. **W1**. |
| R6 | **The multi-approach pattern already ships.** `ThesisTaskDef.approaches[]` gives one goal several routes with different minutes and different progress. | `types.ts:843-855`, `mission01.ts:106-133` | The "choose a transport" decision does **not** need a new engine shape. **W2** copies this. |
| R7 | **Route 06 is wired to the chapter clock** (see R14 for the prologue exception). Fare 7,000đ, wait 4, ride 34, `deadline: 11:30`, `destinationZ: -128`; `transit.ts:152` turns off the demo accelerators when a story clock is present. | `transit.ts:1-15`, `:152`; `transit.storyclock.test.ts` | The slow-but-honest route is already playable. **W4** only needs to make its outcome *mean* something. |
| R8 | **An SMS never becomes a link**, deliberately. | `ChatThread.tsx:143` | The parcel page must stay reachable from an app, not from the message. Already fixed; do not regress. |
| R9 | **`page.*` items are hidden from Mail on purpose**, and a story page resolves through `VIRTUAL_PAGES`. | `mailModel.ts:88`, `sites.ts` | The parcel page's route (courier app → `deliverItem` → Browser) is the pattern for every later page. |
| R10 | **Persistent flags reach street dialogue with no new plumbing.** `RoomChapterLayer.tsx:914` already passes `narrativeState.persistent` into `StoryNpcRuntimeContext.flags`. | `RoomChapterLayer.tsx:914`, `storyCast.ts:73-80` | "She reacts to what you did" needs **data**, not infrastructure. **W5**. |
| R11 | **Every flag Slice A ships is a dead end.** `grep -rn` over `apps/game/src` (excluding tests) returns for `parcelCredentialsExposed`: one writer, zero readers. Same for `parcelFeePaid` and `parcelAtCounter` — the only reader of the last is a `when:` clause inside `mission02.ts` itself. | `mission02.ts:138,161,191,218,247`; `resources.ts:95-99` | The parcel thread currently **cannot affect anything**. §5's test #4 ("no dead flag") would fail on shipped code. **W9**. |
| R12 | **The street dialogue's only flag reader is a single condition statement.** `resolveStoryNpcDialogue` binds `const f = ctx.flags` once (`storyCast.ts:401`) and branches per NPC. | `storyCast.ts:401` | "Cô Ba reacts" is **pure data** — add branches, no plumbing. Already true in v1; now proven. |
| R13 | **The rider's dialogue contains a verdict the brief forbids**, twice, in `insight` fields: *"Mission 02 warning: Off-app cash drivers have no GPS log…"* and *"Red flag: Offering 'unmonitored back-alleys'…"*. | `storyCast.ts:798-800`, `:812-814` | This is a GOOD/BAD button in text form, above a character the mission cannot call wrong. **W0**. |
| R14 | **The transit host is wired for the chapter — but not for the prologue.** `TransitHost` *is* wired end-to-end: `RoomChapterPage.tsx:71-96` builds clock+wallet, `useOutsideWorld.tsx:90` passes it, `OpenWorldEngine.ts:879` hands it to `BusRouteController`, and `transit.ts:152` disables the 12×/5× demo accelerators when a story clock exists. **But** `ProloguePage.tsx:236` calls `useOutsideWorld(roomEngine, …, )` **without** a transit host, so the prologue's bus still runs on the demo clock. | `RoomChapterPage.tsx:71-96`; `transit.ts:152`; `ProloguePage.tsx:236` | v1's claim "Route 06 is wired" was **true for the chapter and unstated for the prologue**. Recorded, not deleted. **W4** adds a test that pins it. |
| R15 | **The interview contact is not in Contacts, and the driver cannot be paid.** There is no `contact.coba` item and no `PAY_FARE` path for cash-in-hand; the driver's 60,000đ exists only as words. | `grep "contact.coba"` → empty; `mission02.ts` has no ride action | W2/W3/W5 are genuinely unbuilt. Confirmed, not assumed. |

### The corrections this research forces (v1 → v2)

1. **The ride is already written; what is missing is that it cannot be taken, and that arriving has
   no consequence.** That part of v1 holds.
2. **The parcel thread is decorative.** v1 treated Slice A as done. R11 shows all three flags are
   write-only, so the thread the mission opens with cannot influence the mission it closes. That is
   not a polish item; it is the same defect as R5 (`backupSecured`) and it is **W9**.
3. **The mission has no conversion chain.** Rockstar's heists work because a crate kept in mission #57
   becomes a minute of time in mission #77 (§1b.8). M02 gathers information and never converts it.
4. **The tone has a forbidden verdict already in it** (R13). Before any new content, the existing
   lines must stop grading people.
5. **v1's own R7 was stated too confidently** for the prologue (R14). Recorded as a correction.

---

## 1b. What the real world says (researched outside the repository)

The repository tells us what exists. It cannot tell us whether M02's fiction is *true*. Everything
below is from published reporting on the actual scams M02 imitates, and each item changes the plan.

### 1b.1 The parcel scam, as it actually runs in Vietnam

Bưu điện Việt Nam issued the warning in August 2026: fake messages tell the recipient that the
parcel is about to be delivered **but the address is incomplete**, and push a link to "update the
address" [2](https://suckhoedoisong.vn/canh-bao-chieu-tro-lua-dao-gia-danh-vnpost-chiem-doan-tai-san-169260826055750822.htm).
The messages arrive from spoofed sender IDs (one police warning names `+212`) and open with a
brand name to look automatic — *"Thông báo giao hàng hôm nay – Cần bổ sung thông tin địa chỉ"*
[2](https://suckhoedoisong.vn/canh-bao-chieu-tro-lua-dao-gia-danh-vnpost-chiem-doan-tai-san-169260826055750822.htm).

What the fake page then asks for, verbatim from the same report:

> "họ tên, số điện thoại, địa chỉ, **số căn cước công dân**, thông tin tài khoản ngân hàng, số thẻ,
> mật khẩu, mã OTP **hoặc thanh toán trước một khoản phí nhỏ** với lý do phí cập nhật địa chỉ,
> phí giao hàng, phí xác nhận hoặc phí xử lý bưu kiện."

Three things here are load-bearing for M02:

1. **The order is real.** Address first, fee after. M02's `ParcelSite` already does this
   (`enter-details` gates `pay-fee`) — that was right, and now it is *documented* as right.
2. **`số căn cước công dân` is missing from M02.** The current page asks for a student number and a
   card. The real page asks for the citizen ID — a specifically Vietnamese detail that no
   international description of this scam would contain, and exactly the kind of detail `audience.md`
   says the game must copy rather than simplify.
3. **The fee is one of four covers** — "phí cập nhật địa chỉ", "phí giao hàng", "phí xác nhận",
   "phí xử lý bưu kiện". M02 only uses one. The others are free realism at no design cost.

The pattern is not Vietnam-only: the UK/US reporting describes the same shape — a small fee
(£1.99 / $1.99) lowers the guard, the link is a look-alike domain, and the fee is bait while the
card is the prize [1](https://safetoopen.com/en/resources/fake-delivery-scams/). The most common hook
is a **small amount with a deadline**, because the real charge, if any, would also appear in the
carrier's own app [2](https://shiptracker.pro/en/blog/tips/fake-delivery-message-scams).

### 1b.2 The fake transfer receipt, which is what Cô Ba is for

This is a mass-market crime in Vietnam, not a niche: fake receipts are sold openly for 20,000–100,000đ
each, covering 13+ banks and e-wallets, advertised as "bill nét, chuẩn ngân hàng 100%"
[7](https://newsletter.ictvietnam.vn/gia-hoa-don-chuyen-tien-dien-tu-de-lua-dao-180379.html).

The published tells, in the order the sources rank them:

| Tell | Source |
| --- | --- |
| Transaction/reference code is too short, all digits, or does not follow the bank's format | [4](https://cystack.net/blog/cach-nhan-biet-bill-chuyen-tien-gia) |
| Font, alignment or spacing differs from the bank's own screen | [3](https://www.dnse.com.vn/hoc/gia-mao-bien-lai-chuyen-tien-thanh-cong) |
| Logo cropped off at the top or bottom edge of the image | [3](https://www.dnse.com.vn/hoc/gia-mao-bien-lai-chuyen-tien-thanh-cong) |
| No NAPAS intermediary line ("Chuyển tiền nhanh qua NAPAS") | [4](https://cystack.net/blog/cach-nhan-biet-bill-chuyen-tien-gia) |
| A strange web address printed at the bottom of the bill | [9](https://congchung247.vn/chieu-tro-lam-gia-bill-chuyen-khoan-de-lua-dao-dien-ra-the-nao/) |

But every one of those sources says the same thing, and it is the sentence M02 must be built on:

> "Cách chắc chắn nhất vẫn là kiểm tra xem giao dịch có thực sự xuất hiện trong tài khoản của mình
> hay không." — [4](https://cystack.net/blog/cach-nhan-biet-bill-chuyen-tien-gia)

> "Không thấy tiền trong tài khoản thì dừng giao dịch... Chỉ nhận được ảnh bill thì không nên tin." — [4](https://cystack.net/blog/cach-nhan-biet-bill-chuyen-tien-gia)

Police guidance is blunter: *"Tuyệt đối không bàn giao tài sản, hoàn tất giao dịch chỉ dựa trên hình
ảnh biên lai do đối phương cung cấp"* — never hand over goods on the strength of an image the other
party supplied [8](https://congan.nghean.gov.vn/thong-tin-chuyen-de/canh-bao-toi-pham/202608/nang-cao-canh-giac-voi-thu-doan-su-dung-bill-chuyen-khoan-gia-de-lua-dao-chiem-doat-tai-san-1059085/).

There is also a second-stage trick worth stealing: the scammer claims the transfer is **"chờ xử lý",
"treo tiền", "chuyển ngoài giờ hành chính"**, and uses the seller's fear of losing the sale to make
them hand over the goods early [3](https://www.dnse.com.vn/hoc/gia-mao-bien-lai-chuyen-tien-thanh-cong).

**Why this matters to the plan:** the shipped engine already has the only correct verification —
`VERIFY_CLAIM { method: "bank-app" }`. The lesson this scam teaches is *not* "learn to spot a forged
font"; it is "stop inspecting the picture and look at your own balance". M02 should therefore make
Cô Ba teach the balance check, and should make every visual tell **present but unreliable** — some
fake bills in the chapter look perfect, because in life some of them do.

### 1b.3 The ride, with real 2026 numbers

Published price tables for 2026: app bike minimum **12,000–14,000đ**, then **4,000–5,400đ/km**;
traditional street bike minimum **15,000–20,000đ**, then **12,000–15,000đ/km**
[2](https://ai-hay.vn/di-xe-om-300m-tra-30k-co-dat-khong-pN1UmIZRHPi). A ~5 km trip: app
25,000–28,000đ, street bike 15,000–35,000đ depending on how well the rider haggles
[1](https://xeducvinh.com.vn/xe-om-cong-nghe-la-gi/). Surge pricing adds 20–50% at 7–9 a.m.
[1](https://xeducvinh.com.vn/xe-om-cong-nghe-la-gi/).

The difference that matters is not price, it is **what is left behind**: GPS tracking, a stored trip
history, driver name/plate/rating, and accident cover of 40–50 million đồng — against a street bike
with no tracking, no insurance, cash only, and a price set by haggling
[1](https://xeducvinh.com.vn/xe-om-cong-nghe-la-gi/).

**The rider's own economics line is out of date too.** He tells the player apps "take 28% commission"
(`storyCast.ts:795-796`). In 2026 a GrabBike driver keeps **60.59%–85.59%** of what the passenger
pays, under a 32% cap on total platform fees (Ministry of Industry and Trade review, 6 Nov 2026);
Be publishes 63.6% (Hà Nội) / 69.4% (TP.HCM); Xanh SM commits 80–90% by programme. A rider honestly
trying to win a fare would quote a number that is true *to him*, not a scary one. W0 gives him one —
which also stops the line working as a disguised warning.

**This exposes a real defect in the shipped dialogue.** The driver in `storyCast.ts:781` says the
app would cost *"105k"* for this trip. For roughly five to six kilometres in 2026 that is about
**three times the real fare**. The fiction therefore makes the unverified rider look like the
sensible, thrifty choice — the player is nudged toward the risky option by a wrong number. That is
the opposite of what the brief asks for (no choice may be a GOOD or BAD button, and the tempting
choice must be tempting for a *real* reason). **W0 fixes the numbers before anything else is built.**

### 1b.4 What this research changes

| Before the research | After |
| --- | --- |
| Parcel page asks for a student number and a card | Also asks for the citizen ID (CCCD), as the real page does |
| One fee name | Use the four cover stories the real messages use |
| Cô Ba teaches visual forgery spotting | Cô Ba teaches the balance check; visual tells stay present but *unreliable* |
| The ride numbers were trusted | `105k` for a 6 km app ride is wrong and biases the player; corrected in **W0** |
| "Verified app" was the safe option | Both are ordinary; the app's advantage is the record it leaves, not its price |

### 1b.5 The psychology the mission is actually modelling

M02 is not a quiz about forged pixels. It is a simulation of a **compliance chain**, and the research
names its links. This matters because each link is a *separate playable beat*, and a mission that
skips one is teaching the wrong lesson.

| Link | What the research says | Where it already lives in M02 | What is missing |
| --- | --- | --- | --- |
| **A small request first** ("foot in the door") | Scammers open with a request so small it barely feels like a decision, then escalate; the victim's own past compliance does the persuading later (Freedman & Fraser 1966, applied to fraud in *Understanding the human element in scams*, 2024; UK OFT/Exeter report: "induction of behavioural commitment") | The 22,000đ fee **is** that request | nothing — this link is already modelled |
| **The reward-to-cost disproportion** | The victim is made to compare a large alleged prize against a trivial payment ("the disproportionate relation between the size of the alleged reward and the cost of trying to obtain it", OFT report) | The parcel is the prize; 22k is the cost | the parcel has no *value* the player can feel. **W9** |
| **Sunk cost** | After the first payment, new fees are justified by what was already spent; people keep paying because stopping means admitting the earlier money bought nothing | Absent — the page has exactly one fee and closes | **W9**: the second ask |
| **Authority + familiarity** | Calls succeed because the caller recites real personal data; leaked data is sold in packages and the second call "knows your name" (Dân trí, Jul 2026; VnExpress "'Hố đen' dữ liệu cá nhân") | `parcelCredentialsExposed` writes the flag and nothing reads it | **W9**: the return call |
| **Time pressure as scarcity** | "act now / respond by June 1" is a standard persuasion element, and it is the *pressure*, not a countdown, that works | `m02.counter-closes` exists but only fires silently at 13:30 | fine as is — do **not** turn it into urgency UI |

**The design consequence, stated as a rule:** every payment the player makes must be able to be
*both* the thing that helps and the thing that costs. A fee that only costs teaches nothing. A fee
that visibly unlocks the parcel teaches the exact habit that ruins real people.

### 1b.6 What the district actually looks like (field reference, not invention)

Two things I did not know before looking, and they change what the shop is:

- **Chợ Lớn in the morning is a canopy, not a street.** Markets in D5 are read from above as an
  overlapping field of vendor umbrellas — browns, a blue, a green — over a well of produce, with
  shophouse façades behind (field photo, D5 street with "two personalities", Saigoneer).
  Consequence: the corner where Cô Ba keeps her shop should be *covered and half-dark*, so the
  player approaches her by walking under fabric, not across an open lot.
- **The district's institutions are the texture.** Temples and assembly halls here worked as
  dialect-group associations: mutual support, commerce, public reputation (Saigon Walks field
  notes, May 2026). Consequence for writing: a shopkeeper in D5 who keeps receipts for a stranger
  is not eccentric — she is doing what the street's institutions have always done. That is one
  line of dialogue, and it makes her legible instead of noble.

### 1b.7 The forgery, as it looks (visual reference)

I looked at real successful-transfer screenshots and real fake ones. The tells that matter are not
the ones a player expects:

- A genuine bank screen is **almost comically sparse**: one green check, the amount, the timestamp,
  the beneficiary name. There is no decoration to get wrong.
- Therefore a good forgery's tells are **absences and drifts**: the reference code too short or all
  digits, a font that shifts mid-line, the bank logo cropped by the image edge, a missing
  interbank (NAPAS) line, a URL printed at the foot (summary of published tell-lists, plus police
  advisories — v1 §1b.2).
- And — the point of the whole mission — **the best forgeries have none of these**. Sources that
  sell these images advertise "bill nét, chuẩn ngân hàng 100%". The only test that survives that is
  the balance in your own account.

**Art direction consequence:** the fake receipt the player must catch is rendered **plainly and
correctly**, not with a subtle "wrong" flavour. The tell is what the player *does*, not what the
pixel looks like. A player who zooms in and finds nothing has been taught the truth.

### 1b.8 How the best games solve this exact problem

The comparison that matters is not *GTA6's scale* — it is *GTA6's mechanism*, plus two studios that
faced the "how do you make verification fun" problem head-on.

**Rockstar's own stated answer (2026, on the record).** David Hynd (VP technology) and Stephen
Donkin (VP design) describe GTA6's missions as deliberately open-ended: they "leveraged a lot more
of our regular mechanics/AI and systems within Missions", they "worked really hard to blur the lines
between 'on-Mission' and 'off-Mission'", and they "really wanted to reduce the number of mission
fails for the player experimenting" (Eurogamer, GamesRadar, TechRadar, Nov 18–19 2026). Consequence:
systems must not behave differently inside a mission than outside it. **That is a direct constraint
on M02**: the payment page, the ledger and the clock must be the *same* systems the player uses at
08:05 while wandering, or the mission is not Rockstar-shaped, it is a special case.

**Rockstar's structural answer: preparation converts into capability.** The Cartel Heist is the
cleanest published example of the shape M02 needs. `Company Property` (#57) is a courier run where
**every crate you keep becomes one explosive charge later**; `Hidden Charges` (#62) plants them;
the count of charges sets the **police-distraction clock inside the finale** (walkthroughs converge:
all three towers rigged → "just under 11 minutes"; one crate lost → one charge fewer → one tower
fewer → less time). `Safe Word` (#61) teaches the vault minigame *before* the vault. `The Missing
Link` (#72) is an information-gathering errand that determines what you can do inside the bank.

**What that implies for M02, concretely.** The mission currently has no conversion. The slip is
read or not read; nothing carries. The researched real scam has exactly the structure Rockstar
uses: *information gathered earlier determines what you can do later, and the cost of earlier choices
sets the size of the later window.* M02 should be built as a three-link chain:

| Link | Prep beat (free roam) | Converts into | Paid off in |
| --- | --- | --- | --- |
| 1 | Read the paper slip; find the code | the parcel lookup is 4 min instead of 8 (`MISSION_02_CONFIG.minutes`, already shipped) — **and now also**: the code is what makes Cô Ba able to check the parcel | W9 |
| 2 | Decide whether to log in / pay the fake fee | `parcelCredentialsExposed`, `parcelFeePaid` — written and **read by nothing** (proved in §1, R11) | W9 |
| 3 | Cô Ba teaches the balance check | the player's own verification method, usable at 11:41 and again at M05 | W5, W6 |

**The two games that prove the "verification is the gameplay" thesis.**

- **Papers, Please** makes a clerk's *comparison* the entire verb set: rulebook, documents, stamp.
  The lesson is transferable and cheap: a mission about fraud should let the player *hold two
  things and compare them*, not read a verdict.
- **Return of the Obra Dinn** is the closer fit, and two of its decisions are directly applicable:
  1. **It withholds confirmation on purpose.** Fates are only confirmed in **batches of three**,
     explicitly "to prevent cheating" — Pope: *"marking fates correct as they were entered couldn't
     work because it'd be too tempting to cheat, even for honest players."* A correct answer that
     never got confirmed by the game is the exact feeling M02 wants: the player must decide whether
     they are right with no meter to tell them.
  2. **Every clue carries two facts**: one explains the local moment, one points elsewhere. M02's
     slip already does this (it explains the parcel *and* holds the code), and the receipt should
     too (it settles this sale *and* dates the habit).

**And the anti-model I will not copy: Disco Elysium's skill voices.** Its inner-monologue system is
brilliant, but it is the opposite of what M02 needs — a voice in the player's head that comments on
the manipulation would be SCAMMAZE's forbidden "warning". The one thing worth stealing is smaller:
Disco Elysium narrativises failure ("a little ending for every failure" — post45.org), which is
exactly the canon rule that missing Cô Ba must produce a *different day*, not a retry screen.

---

## 2. The design rule this plan obeys

From the owner brief (Thẻ 1, Thẻ 2), quoted because every work unit is judged against it:

- The player is **not** given a "find the scammer" quest. Alex is trying to graduate. Scams are
  obstacles that happen to be in the way.
- **No choice is a GOOD or BAD button.** A safe choice costs time, money or an opportunity; a risky
  choice solves the immediate problem and creates a larger one later.
- **The five-step loop**: Free Roam → Dynamic Events → Decision → Consequence → Adaptive Mission.
- **No warning-summary screen.** The player observes, remembers and verifies.
- **Failure leaves consequences.** No auto-refund, no auto-recovery, no skip-everything button.
- **Every branch must be able to return to the main task**, but must never erase money, data,
  leaked documents or a relationship.
- **Success is not "protected everything".** It is making a deliberate choice and knowing what it
  cost.

The last one is the hardest to build, and it is what §5's acceptance tests are written against.

---

## 3. The three routes, with real numbers

All of these already exist as *numbers* in the repository; only the plumbing is missing.

| | Take the bus | Book the app | Take the driver |
| --- | --- | --- | --- |
| Cost now | **7,000đ** (`transit.ts:7`) | **~34,000đ** for ~6 km at 2026 app rates (W0 corrects the shipped `105k`) | **60,000đ** — *more* than the app (W0 corrects this too) |
| Time | wait 4 + ride 34 = **38 min** (`transit.ts:8-9`) | **~20 min** (W2 sets it) | **~18 min** (W3 sets it) |
| What it leaves behind | fare line in the ledger | fare line + a stored trip: driver, plate, route, insurance | **nothing** — no record, no route, no counterparty, no cover |
| What it costs later | may miss 11:30 if left after 10:56 | the most expensive of the three | W3: he does not go where he said |
| Is it wrong? | no | no | **no** — he is fast and he is friendly, and that is exactly the problem |

The last row is the point of the mission. The driver is not a trap with a sign on it; he is the
obvious answer to a real problem, and the reason he is a bad answer only becomes visible after.

---

## 4. Work units

Each unit is independently shippable, independently testable, and ends green. They are ordered by
dependency, not by size. **No unit may be described as finished before its gate passes.**

### W0 — Correct the numbers the fiction got wrong

- **What**: three shipped strings contradict researched 2026 reality and, together, they bias the
  player toward the risky option:
  1. `storyCast.ts:781` — the driver says the app would cost *"105k"*. For ~6 km at 4,000–5,400đ/km
     plus a 12–14k minimum, the real figure is roughly **34,000đ** (1b.3). At `105k` the app looks
     absurd and the 60,000đ rider looks like a bargain.
  2. the same line calls the bus wait "forty minutes" while the bus is authored to wait **4** and
     ride **34** (`transit.ts:8-9`); the wait the player actually experiences is 4.
  3. Minh's `minh_m02_route` (`storyCast.ts:487-489`) frames the app as the safe choice and the
     rider as a "risk". The brief forbids that framing: neither may be a verdict.
- **Why it is first**: every later unit measures *choices*. If the numbers lie, a test that
  "RUN A and RUN B differ" can pass while the design is wrong. Correcting the inputs comes before
  building on them.
- **Constraint**: the fix must not make the driver unattractive. After W0 he is the **fastest and the
  friendliest** option at a price that is honestly higher than the app — the player picks him
  because he is right there and because haggling feels normal, not because he is cheap.
  4. `storyCast.ts:798-800` and `:812-814` — the rider's `insight` fields say *"Mission 02 warning:
     Off-app cash drivers have no GPS log"* and *"Red flag: Offering 'unmonitored back-alleys'"*
     (R13). These are verdicts about a person the mission is forbidden to convict. They become
     **facts he states about himself** ("không có camera, không có đèn đỏ" — he already says this)
     and lose the word *warning* and *red flag* entirely.
- **Gate**: a test asserts the three route costs are ordered as the research says (bus < app <
  rider in price, rider < bus in time); a locale test asserts no route is described with a verdict
  word in either language, **including inside `insight` strings** — the field name "insight" is the
  loophole that let R13 through.

### W1 — The backup drive can be picked up

- **What**: a `DeviceItemDef` (or interactable) that lets Alex secure the backup drive, setting
  `backupSecured` (R5) and costing minutes.
- **Where**: `chapter1/mission02.ts`; nothing new in the engine.
- **Why it is first**: it is the brief's first clause, it uses a flag that already exists and is
  already read by the Files app, and it gives the day a positive objective that is not the scam.
- **Gate**: `validateScenario` stays `[]`; a reducer test proves the flag flips and the Files app
  shows it; `foundation.test.ts`'s exact-flags assertion is updated **only** if a new flag is added
  (the plan avoids new flags).

### W2 — A booked ride is a real option

- **What**: a ride-app item whose action books the trip for a fixed fare and duration; the outcome
  is a `PAY_FARE`-shaped payment plus a trip the world clock respects.
- **Where**: `chapter1/mission02.ts` (`app.*` item), reusing the `ThesisTaskDef.approaches` idea (R6)
  as **data**, not as a new action kind.
- **Explicit non-goal**: no new core action. If this needs `CoreAction` #17, stop and re-scope.
- **Gate**: one ledger line; cash moves by exactly the authored amount; a rejected booking (not
  enough cash) leaves state untouched; the ride's minutes appear on the chapter clock.

### W3 — Taking the driver does something

- **What**: the player can accept the driver's 60,000đ offer, and the offer has a consequence: he
  does not take Alex to the District 5 address. Alex arrives somewhere else, later, with no record
  of the trip (no ledger, no history) — which is exactly what the dialogue already warns about, and
  the game never says it.
- **Where**: an `app`/`contacts` action that writes the flag, plus the dialogue branch that reacts
  to it. The driver's existing lines (`storyCast.ts:772-800`) stay **unchanged**; only his
  `missionBadge`-selected replies gain a post-hoc branch.
- **Constraint from the brief**: this must not be a "mission failed" state. Alex can still get to
  District 5 afterwards — late, and by another route.
- **Gate**: a reducer test for the accepted path; a jsdom test proving the reply changes when the
  flag is set; and an assertion that **no** notice or HUD text names the driver as dangerous.

### W4 — Arriving late is a state, not a screen

- **What**: the 11:30 window (already `cal.interview` 11:30–12:30) and the 13:30 counter closing
  already exist as data. W4 makes *being late* visible in the world instead of in a modal: Cô Ba's
  schedule slot ends at 1260 (R2), so the same NPC must speak differently after it.
- **Where**: `mission02.ts` event effects; `storyCast.ts` reply selection.
- **Gate**: two playthroughs of the same day produce different `transcript` text and different
  flags; neither produces a failure screen; `analyzeReachability` stays clean.

### W5 — Cô Ba has a body, a memory, and one true lesson

- **What**: `interviewee_q5` gets a `worldAnchor` at the Chợ Lớn counter (`z≈-128`, R2), joins
  `OPEN_WORLD_STORY_NPCS` (7 not 6), and gains flag-driven replies through the one reader that
  already exists (`storyCast.ts:401`, R12).
- **The lesson she teaches is the researched one, not the invented one.** She does not teach
  font-spotting. She teaches what every Vietnamese source and the police say:
  **stop looking at the picture, look at your own balance** (§1b.2). Concretely:
  - She shows Alex **her own phone**: the notification list, where a real transfer appears.
  - She shows him a receipt that is, as far as the pixels go, **perfect** (§1b.7). There is no tell.
  - The line that carries the mission, in her voice, is the one-line version of
    *"Không thấy tiền trong tài khoản thì dừng giao dịch."*
- **Why this is a real design risk, stated openly.** A player who has learned "fake receipts have
  wrong fonts" will *fail here* and be angry. That is intended: the published tell-lists are the
  reason people still get robbed. The mitigation is not to soften her lesson; it is to make the
  *attempt* to spot the tell **cost minutes** (he zooms, he compares, he is slow) while the balance
  check costs one look. Learning is measured in time, not in a pop-up.
- **Reachability cost**: `storyCast.test.ts` asserts `OPEN_WORLD_STORY_NPCS.length === 6` → 7, and
  the 4 m separation loop must still pass. This is a real test edit, not a formality.
- **Ship rule**: if the owner cannot check the anchor visually, this unit ships **behind the same
  switch as the rest** and is reported as `IMPLEMENTED, not visually verified`.
- **Her subject matter comes from research, not invention** (1b.2): the chapter ships at least one
  fake receipt that is visually flawless, so a player who "learns the tells" still fails and a
  player who checks the balance does not. This is the one place the game is allowed to be quietly
  brutal, because it is true.

### W6 — The parcel thread earns its minutes, with the details the real page asks for

- **What**: the parcel page and courier app already work (fixed in `2fc9157`). W6 aligns the page
  with the researched original (1b.1) and makes the thread *cost* something.
  - The page also asks for the **citizen ID (CCCD)**, as the real one does — the most
    Vietnam-specific detail in the whole scam, and the one an international clone would omit.
  - The fee is framed with one of the four covers the real messages use ("phí cập nhật địa chỉ",
    "phí giao hàng", "phí xác nhận", "phí xử lý bưu kiện"), not a generic "redelivery fee".
  - Reading the slip makes the counter visit cheaper (already data); paying the fake fee writes a
    ledger line Mission 05 can quote back (already a flag).
  - What is missing is that **nothing tells the player afterwards**. W6 therefore also owns the
    debrief: what was spent, what was not, derived only from the event log.
- **Gate**: the debrief lists what was spent and what was not, derived only from the event log, and
  never calls anything "safe" (`Requirement 16.6`).

### W7 — Two runs really differ

- **What**: the acceptance test for the whole plan. Two scripted playthroughs through the real
  reducer: **RUN A** (take the driver, pay the fake fee, arrive late) and **RUN B** (take the bus,
  skip the fee, arrive on time). Assert that the two end states differ in at least cash, evidence,
  `backupSecured`, and at least one dialogue-visible flag.
- **Gate**: RUN B must also have lost something real — per the brief, "a safe choice can cost time,
  money or a real opportunity". A test asserts that RUN B is **not** strictly better than RUN A.

### W9 — The parcel thread stops being decoration *(must land before W8)*

**Why this unit exists:** R11. Every flag Slice A writes is read by nothing, so the mission's opening
thread cannot reach its own ending. This is also where the researched compliance chain (§1b.5)
becomes playable, because the chain *is* cause and effect.

- **What**:
  1. **The second ask.** If `parcelFeePaid` is true, a second message arrives a while later: a
     different fee, a different cover name, and the sentence that makes it plausible — that the
     first payment is being "processed". This is the sunk-cost link, and it is *not* a new trap;
     it is the one the player walked into. It must be **declinable at every step** and must never
     cost more than the player could earn back, or the mission becomes a punishment.
  2. **The return call.** If `parcelCredentialsExposed` is true, an incoming contact uses something
     the player typed into the fake page. This is the familiarity link. It is delivered through the
     **existing call/event system**, and it must be recognisably the same pattern as the first scam
     without any character saying so.
  3. **Cô Ba can only check the parcel if the player has the code** (the slip). If they do not, her
     answer is honest and useless — she is not a hint dispenser, she is a busy shopkeeper.
  4. **Reach-forward.** All three states must be readable by `resolveStoryNpcDialogue` so that
     Mission 05's street scenes can quote them, and by the debrief (W6) so the player sees what the
     day actually cost.
- **What it is NOT**: no new `CoreAction`, no new resource, no new flag family beyond what exists.
  The effects are `setPersistent`, `deliverItem`, `adjustResource` — the four kinds already in the
  data. If a step needs an engine shape that does not exist, it is cut, not built.
- **Gate**:
  - a test that every flag M02 writes has a **reader outside `mission02.ts`** (the §5 #4 test,
    which now fails on shipped code and must pass after W9);
  - a reachability test: both `parcelFeePaid` paths reach Cô Ba's shop by 11:30 *and* both reach the
    debrief;
  - a tone test: no string in the second-ask thread contains a verdict word (§5 #1) — the second
    message must sound **reasonable**, or it teaches nothing.

### W10 — Preparation becomes capability (the GTA6 structure, honestly scoped) *(last, and cuttable)*

**Why this unit exists:** §1b.8. M02 gathers information and never converts it; Rockstar's heists are
nothing *but* conversion. This is the unit that makes the mission feel authored rather than scripted.

The conversion table, with every row traced to something that already exists:

| Prep the player did | Converts into | Mechanism (existing) | Where it pays off |
| --- | --- | --- | --- |
| Read the slip (code known) | lookup 4 min instead of 8; Cô Ba can verify the parcel | `MISSION_02_CONFIG.minutes`, shipped | W5, W9 |
| Looked up the parcel **before** paying | the player knows the counter is free, so the 22k message is contradicted by their own record | `parcelAtCounter` (write-only today) | W9's return call, W6's debrief |
| Paid the fee | a second ask exists; the day costs more; the debrief has a line | `parcelFeePaid` | W9 |
| Typed the details | the return call happens | `parcelCredentialsExposed` | W9 |
| Secured the backup drive | `backupSecured` — read by the Files app at `device.ts:302` | `setPersistent` | shows in M05; visible in Files all day |

- **The rule W10 enforces**: **nothing the player does at 08:05 is inert.** Every one of the five
  rows above must be observable in the world later the same day, or it should not be in the game.
- **Honest limit, written down now**: this is not "GTA6 in miniature". There is no separate heist
  finale in M02, and inventing one would be a new mission, not a fix. W10 converts preparation into
  *visible state and different subsequent beats*, which is the mechanism Rockstar uses, at the scale
  this chapter can carry without lying to itself.
- **Gate**: a single test that walks the five rows and asserts each is observable — i.e. for every
  row there exists a reachable state difference that a player could notice without a HUD.

### W8 — Documentation truth pass

- **What**: `OVERVIEW.md` §4.2.3 gains M02; the M02 spec gains a "what building it changed" section
  in the style of §"What Slice B changed on contact with the code"; status labels stay honest.
- **Gate**: no document claims something the tests do not prove; `IMPLEMENTED` appears only next to
  features covered by a green test.

---

## 5. How this plan is judged (acceptance tests)

Written now, before the work, so that "done" cannot drift:

1. **No GOOD/BAD**: a grep-based test that no M02 string contains a verdict word, in either locale.
2. **No failure screen**: no M02 state sets `status` to anything but `playing` before the chapter's
   own ending.
3. **No warning summary**: the debrief lists *events*, never a checklist of "warning signs found".
4. **No dead flag**: every flag M02 writes is read by something **outside `mission02.ts`**. Note
   that this test *fails on shipped code today* (R11), which is why W9 precedes W8.
5. **No unreachable content**: every item, page and action M02 authors is reached by at least one
   test playthrough — the defect that `2fc9157` fixed must not recur.
6. **No strictly-better route**: RUN B is not dominated by RUN A on every axis.
7. **Gates in order**: `pnpm test` → `pnpm typecheck` → `pnpm build`, per
   `chapter-01-double-deception/requirements.md` 23.6.
8. **Nothing at 08:05 is inert** (W10): each preparation row produces an observable state difference
   the same day.
9. **No verdict inside `insight`** (R13): the loophole that let "Mission 02 warning:" ship.
10. **The flawless receipt stays flawless**: an art/content test asserts the receipt the lesson
    hinges on carries **no** visual tell-by-design tell (no cropped logo, no odd code), because
    "make it look wrong" is the failure mode this whole mission argues against.

---

## 6. Research protocol (standing instruction)

This task is research-driven, not just build-driven. Every work unit starts with reading, not
writing:

0. **Research the world, not only the repository.** The repository says what exists; it cannot say
   whether the fiction is true. Every claim about how the scam actually works must come from a
   published source (§1b), and every number in the fiction (fares, fees, waits) must be checked
   against 2026 reality. This rule exists because following it overturned three shipped strings and
   found a bias toward the risky choice (W0).
1. **Read the source before the plan.** No unit is estimated from memory. Each unit in §4 began with
   a `grep`/`sed` over the real files, and §1 cites the lines.
2. **Read the brief before the design.** The owner document is the source of intent; the repository
   is the source of truth about what exists. Where they conflict, §7 records it and asks.
3. **Read GTA 6's *systems*, never its content.** The borrow is structural — no mission replay,
   preparation changing outcomes, failure that continues the situation rather than ending it,
   invisible guidance, NPCs reacting to *what the player is* rather than to a choice button — and
   each is cited to a review, never asserted from memory.
4. **Verify every claim with a command.** "The driver exists" is worth nothing without
   `storyCast.ts:211`. Every factual sentence in a pull request must be reproducible by running
   something.
5. **Play it, then claim it.** No unit is reported as working until a test drives the mounted UI, not
   only the reducer. The parcel defect proved that reducer tests alone cannot see a dead end.
6. **Write the correction down.** When research overturns a plan (as §1 did to the previous draft of
   this file), the overturned version is recorded, not deleted, so the next reader does not repeat
   it.
7. **Stop and ask where the answer is a value judgement.** Whether a real Vietnamese courier brand
   may be imitated, how harsh the driver's consequence may be, and what "success" means for a
   player who skips the interview — these are the owner's decisions, and this plan marks them as
   such instead of choosing silently.

---

## 7. Open decisions (owner only)

1. **Brand realism.** `audience.md` (rule of 2026-11-22) says a scam must imitate a *real* target
   with few details wrong. M02 currently uses a fictional courier on a reserved domain. Either the
   rule is applied (a real brand look-alike, DNS-checked, added to `approvedDomains.ts`) or M02 is
   recorded as a documented exception. **Not decided here.**
2. **How bad is the driver's outcome?** He is cheap and effective; the cost is that the trip leaves
   no record. The plan's default is "wrong destination, later, still recoverable". A harsher version
   (lost phone, exposed data) is possible and is the owner's call.
3. **Battery.** `M02` spec §15.1 asks whether the phone battery is presentational or a resource.
   Nothing in the owner brief mentions battery, and the chapter already has six resources. This
   plan assumes **presentational only**, and will not add a seventh resource.
4. **What counts as success if the interview is skipped?** The brief says success is "knowing what
   you traded". This plan treats a skipped interview with a secured drive as a valid, different
   outcome — not a failure. Confirmation needed.
5. **May a fake receipt be flawless?** (new, and the sharpest question in the plan) §1b.2 says the
   only reliable check is the player's own balance, and §9 C1 says teaching that is a gamble.
   Default in this plan: **yes, one flawless receipt**, with a cheap alternative the player declined.
   This is a product decision about how hard the game is allowed to be, so it is the owner's.
6. **How much CCCD may the fake page ask for?** (new) The real page asks for `số căn cước công dân`.
   Adding it is *more* honest and *more* disturbing; the audience note (`audience.md`) argues for
   imitating the real target, while the doc's "all fictional" principle argues for restraint.
   Default in this plan: **ask for it, but never let the game store, echo or display a plausible
   value** — the field accepts typing and the page thanks the player, nothing more.

Two decisions I am **not** asking for, because they are already answered by the sources: the four
fee cover names (§1b.1) and the fare figures (§1b.3). Those are corrections, not choices.

---

## 7b. What I would cut first, if the calendar is real

Ranked by "how much of the mission survives without it". Useful because every honest plan has a
cut list, and writing it now makes the cuts decisions instead of accidents.

| Cut | Cost of cutting | What survives |
| --- | --- | --- |
| **W10** (conversion table) | the mission loses its Rockstar shape and becomes a well-written errand | everything else; the checks still hold |
| **W9's second ask** | the sunk-cost link disappears; the parcel thread stays decorative | the balance lesson (W5) is unaffected |
| **W4 lateness/schedule polish** | timing feels slightly loose; the late-arrival state still ships via W3 | nothing structural |
| **W5's 3D body** | Cô Ba survives as Contacts-only (`contact.coba`), the record layer alone | the *lesson* survives intact; only presence is lost — and presence is what §12 asks about |
| **W0** | **nothing may be cut here.** the mission would ship teaching that the app costs 105k | — |
| **W5's flawless receipt** | **do not cut.** cutting it makes the mission teach the tell-list, i.e. the thing that does not work | — |

Two rows above say "do not cut". They are the two places where the plan is not a preference.

## 8. Order of work, and what to report

| Step | Unit | Report |
| --- | --- | --- |
| 0 | W0 | one commit; states the researched figures **and** the verdict purge (R13) in the message so the change is auditable |
| 1 | W1, W2 | one commit each, with the reducer test named in the message |
| 1.5 | W9 | before W8, because §5 #4 fails until it lands |
| 2 | W3, W4 | one commit, because they are the same decision seen from two sides |
| 3 | W5 | one commit, explicitly marked "not visually verified" if the owner has not checked the anchor |
| 4 | W6 | one commit |
| 5 | W7 | this is the gate; if it fails, earlier units reopen |
| 6 | W8 | documentation truth pass |

Each step ends with: the three gates green, the PR body updated with what actually changed, and a
short note listing **what could not be checked in this environment** (real GPU placement, real audio,
real-device pacing). No step is described as playable until W7 passes.

---

## 9. Self-critique: where this plan is probably wrong

Written by the same person who wrote the plan, on purpose, because a plan nobody attacked is a plan
nobody read.

**C1 — The balance-check lesson may not survive contact with players.**
I am betting that showing a *flawless* fake receipt and teaching the balance check is more honest
and more useful than teaching the tells. But it may read as "the game cheated me": the player did
what a hundred articles told them to do, and lost. Counter-argument, and why I still hold: the
articles are the reason people lose. But this is **the single biggest design gamble in the mission**
and it must be playtested by someone who has not read this document before W5 is called done. If it
fails that test, the fix is not to remove the flawless receipt — it is to give the player a *cheap
way out that they chose not to take*, so the loss is visibly their call.

**C2 — W9's second ask can easily become a punishment loop.**
Sunk-cost is real, which is exactly why it is dangerous to simulate: a player who pays twice may just
feel farmed. The guard I have written (declinable at every step, recoverable cost) is necessary but
may not be sufficient. **Kill criterion:** if playtesters describe the second message as "obviously
a scam" *or* as "unfair", the beat is misfiring in both directions and should be cut down to a single
line in the debrief rather than a second page.

**C3 — I am importing GTA6's structure from walkthroughs, not from the game.**
Every claim in §1b.8 about `Company Property` → `Hidden Charges` → the heist clock comes from
published guides (timesaver, clutchbase, sportskeeda, egamers, gamerant), not from playing it or
reading Rockstar's design documents. The *structure* is corroborated across five independent
walkthroughs, which is why I trust it; the *numbers* (11 minutes, three charges) are guide-reported
and should not be quoted as canon anywhere in the product.

**C4 — "Rockstar-shaped" may be the wrong target for a 2D/3D browser chapter.**
Rockstar's openness costs an enormous simulation budget. The honest version of this plan copies the
*mechanism* (prep → capability, no special-case systems) and not the *scale*. If a reviewer reads
§1b.8 as "make M02 like GTA6", they have read it wrong, and that ambiguity is my fault, not theirs.

**C5 — The research is Vietnamese-specific and that is a choice, not a universal.**
The parcel scam I model is the one hitting Vietnam in 2026 (VNPost impersonation, CCCD harvesting,
20–100k fake receipts). International readers will recognise the *shape* (small fee + deadline +
look-alike) but not the details. If the product's audience is not primarily Vietnamese, W6's CCCD
detail is the first thing that should go.

**C6 — I have not verified the 3D result, and I cannot.**
No GPU screenshot in this environment. Every claim about how Cô Ba's corner *looks* is a claim about
data and layout, not about pixels. It will be labelled `not visually verified` until someone runs it.

**C7 — The biggest risk is not in this document.**
It is that this plan is *interesting* while the mission is still *not fun to play*. A perfect
compliance chain around a character the player never wants to talk to is still a bad mission. The
only defence is §12's five questions, asked to a real person, after W7.

---
