// Mission 01, the two optional side missions: EASY MONEY and THE GOLDEN PLATFORM.
// Pure TypeScript data. Both come from the design brief ("Thẻ 1", Mission 01, and "Thẻ 2", Easy Money
// and The Golden Platform). Both are optional, arrive while Alex works on the thesis, cost time and
// can cost money, evidence or event state. Nothing here is marked as good or bad: the player reads
// the figures and decides.
//   EASY MONEY: a student recommends an online job. Simple tasks show a small income. Then the page
//     asks for a deposit to go on. Stop, check, deposit or go on. The shown balance grows, but the
//     money that can be withdrawn stays at zero. Several deposits can lead to debt.
//   THE GOLDEN PLATFORM: an acquaintance recommends an investment. The page shows profit that does
//     not exist, the money Alex sent is locked, and every withdrawal asks for a new fee.
// Everything is simulated: no real money, account, platform or link. Addresses are plain text on
// reserved domains. Numbers the brief does not give are placeholders in `MISSION_01_OFFERS_CONFIG`.
//
// What stays for later missions (persistent flags and the bank ledger):
//   lostMoneyToScam, easyMoneyDeposited, investmentFundsLocked, debtFromScam (Mission 03: money and
//   housing), scamEvidenceSaved and recoveryOfferEligible (Mission 05: a recovery offer that refers
//   to the loss). The ledger lines keep every amount. Nothing here ever gives money back.
import { minutesFromStart } from "../resources";
import type { Condition, DeviceItemActionDef, DeviceItemDef, Effect, GameEventDef, MissionDef, MissionStepDef } from "../types";

/** Placeholders for everything the brief does not state. Change them here, not in the data below. */
export const MISSION_01_OFFERS_CONFIG = {
  /** When the offers reach Alex, in minutes since Tuesday 17:00: Tuesday 19:30 and Tuesday 21:30. */
  easyMoneyAtMinute: minutesFromStart(2, 19, 30),
  goldenPlatformAtMinute: minutesFromStart(2, 21, 30),
  easyMoney: {
    /** Deposits the page asks for, in order, VND. The third one is "tax" and can push Alex into debt. */
    depositsVnd: [300_000, 700_000, 1_200_000],
    /** Balance the page shows after each step (not money): task 1, deposit 1, task 2, deposit 2, task 3, deposit 3. */
    shownVnd: [45_000, 345_000, 600_000, 1_300_000, 2_000_000, 3_200_000],
    /** Smallest amount the page says can be withdrawn. */
    minimumWithdrawalVnd: 500_000,
    /** Minutes after the first deposit at which the page pushes with a deadline, if Alex has not gone on or stopped. */
    pressureAfterMinutes: 30,
    minutes: { read: 2, ask: 5, decline: 1, check: 15, task: 20, deposit: 5, tryWithdraw: 5, saveRecords: 5, stop: 2 },
  },
  goldenPlatform: {
    /** Starter plan, upgrade plan and the three fees that every withdrawal asks for, VND. */
    investVnd: 500_000,
    upgradeVnd: 1_000_000,
    feesVnd: [150_000, 300_000, 600_000],
    /** Balance the page shows: after the starter plan, after the dashboard check, after the upgrade (not money). */
    shownVnd: [540_000, 580_000, 1_680_000],
    /** Minutes after the first investment at which the "profit" notice arrives. */
    profitNoticeAfterMinutes: 60,
    minutes: { read: 2, ask: 5, decline: 1, check: 10, invest: 5, dashboard: 3, withdraw: 10, fee: 5, saveRecords: 5, leave: 2, authorityCall: 5, authorityAsk: 10 },
  },
} as const;

const EM = MISSION_01_OFFERS_CONFIG.easyMoney;
const GP = MISSION_01_OFFERS_CONFIG.goldenPlatform;

const done = (itemId: string, actionId: string): Condition => ({ kind: "itemActionDone", itemId, actionId });
const arrived = (itemId: string): Condition => ({ kind: "itemArrived", itemId });

/** Effects of sending money to a platform: the loss is recorded for the later missions. */
const LOSS: Effect[] = [
  { kind: "setPersistent", flag: "lostMoneyToScam", value: true },
  { kind: "setPersistent", flag: "recoveryOfferEligible", value: true },
];

const dong = (amount: number): string => amount.toLocaleString("en-US");

export const MISSION_01_OFFERS_LEDGER_LABELS: Record<string, string> = {
  "ledger.job-deposit-1": "Deposit to an online job platform",
  "ledger.job-deposit-2": "Deposit to an online job platform",
  "ledger.job-deposit-3": "Deposit to an online job platform",
  "ledger.invest-1": "Payment to an investment platform",
  "ledger.invest-2": "Payment to an investment platform",
  "ledger.invest-fee-1": "Fee asked by an investment platform",
  "ledger.invest-fee-2": "Fee asked by an investment platform",
  "ledger.invest-fee-3": "Fee asked by an investment platform",
};

// ---------------------------------------------------------------------------------------------
// EASY MONEY
// ---------------------------------------------------------------------------------------------

const P = "job.platform";
const T = EM.minutes;

const deposit = (index: 0 | 1 | 2, after: string, label: string): DeviceItemActionDef => ({
  id: `deposit-${index + 1}`,
  label,
  visibleWhen: [done(P, after)],
  timeCostMinutes: T.deposit,
  cashCost: EM.depositsVnd[index],
  ledgerLabel: `ledger.job-deposit-${index + 1}`,
  ledgerCategory: "locked",
  counterparty: "QuickPay Tasks",
  once: true,
  effects: [...LOSS, { kind: "setPersistent", flag: "easyMoneyDeposited", value: true }],
});

const EASY_MONEY_ITEMS: DeviceItemDef[] = [
  {
    id: "msg.easy-money",
    app: "messages",
    title: "Linh",
    from: "Linh (student, another faculty)",
    body:
      "Hi Alex! I found an online job. You rate short product pages, about 5 minutes each, and the money shows in the app right away. " +
      "I got my first reward today. Try it, it is easy money for a student: quickpay-tasks.vn",
    arrives: { atMinute: MISSION_01_OFFERS_CONFIG.easyMoneyAtMinute },
    actions: [
      {
        id: "ask-linh",
        label: "Ask Linh how she was paid",
        timeCostMinutes: T.ask,
        once: true,
        transcript: [
          { speaker: "alex", text: "Nice! How did you get paid? Did you have to pay anything?" },
          {
            speaker: "other",
            text: "The tasks pay in the app. For level 2 I paid a deposit of 300,000 and they say it comes back with my earnings. I tried to withdraw but it says my account is under review.",
          },
        ],
        effects: [{ kind: "adjustResource", resource: "evidence", delta: 1 }],
      },
      { id: "open-link", label: "Open the job page", timeCostMinutes: T.read, once: true },
      {
        id: "decline",
        label: "Tell Linh thanks, but no",
        timeCostMinutes: T.decline,
        once: true,
        transcript: [
          { speaker: "alex", text: "Thanks Linh, but I will pass. I must finish my thesis first." },
          { speaker: "other", text: "OK, no problem. Best of luck with the thesis!" },
        ],
      },
    ],
  },
  {
    id: P,
    app: "jobs",
    title: "Online tasks: rate product pages",
    from: "QuickPay Tasks",
    detail: "quickpay-tasks.vn",
    body:
      "Earn money from your phone. Rate product pages and get paid for every task.\n\n" +
      "Level 1: free tasks. Higher levels need a deposit and pay more.\n\n" +
      "This page is a simulation. No real money, account or task is used in this game.",
    arrives: { when: [done("msg.easy-money", "open-link")] },
    figures: [
      {
        when: [{ kind: "anyOf", conditions: [done(P, "deposit-3"), done(P, "deposit-3-borrow")] }],
        rows: [{ kind: "real" }, { kind: "shown", amountVnd: EM.shownVnd[5] }, { kind: "withdrawable", amountVnd: 0 }, { kind: "locked", amountVnd: EM.depositsVnd[0] + EM.depositsVnd[1] + EM.depositsVnd[2] }],
      },
      {
        when: [done(P, "do-task-3")],
        rows: [{ kind: "real" }, { kind: "shown", amountVnd: EM.shownVnd[4] }, { kind: "withdrawable", amountVnd: 0 }, { kind: "locked", amountVnd: EM.depositsVnd[0] + EM.depositsVnd[1] }],
      },
      {
        when: [done(P, "deposit-2")],
        rows: [{ kind: "real" }, { kind: "shown", amountVnd: EM.shownVnd[3] }, { kind: "withdrawable", amountVnd: 0 }, { kind: "locked", amountVnd: EM.depositsVnd[0] + EM.depositsVnd[1] }],
      },
      {
        when: [done(P, "do-task-2")],
        rows: [{ kind: "real" }, { kind: "shown", amountVnd: EM.shownVnd[2] }, { kind: "withdrawable", amountVnd: 0 }, { kind: "locked", amountVnd: EM.depositsVnd[0] }],
      },
      {
        when: [done(P, "deposit-1")],
        rows: [{ kind: "real" }, { kind: "shown", amountVnd: EM.shownVnd[1] }, { kind: "withdrawable", amountVnd: 0 }, { kind: "locked", amountVnd: EM.depositsVnd[0] }],
      },
      {
        when: [done(P, "do-task-1")],
        rows: [{ kind: "real" }, { kind: "shown", amountVnd: EM.shownVnd[0] }, { kind: "withdrawable", amountVnd: 0 }, { kind: "locked", amountVnd: 0 }],
      },
      { rows: [{ kind: "real" }, { kind: "shown", amountVnd: 0 }, { kind: "withdrawable", amountVnd: 0 }, { kind: "locked", amountVnd: 0 }] },
    ],
    actions: [
      {
        id: "check-company",
        label: "Look up the company name and its registration",
        timeCostMinutes: T.check,
        once: true,
        effects: [{ kind: "adjustResource", resource: "evidence", delta: 1 }],
      },
      {
        id: "do-task-1",
        label: "Do level 1 tasks: rate 3 product pages",
        timeCostMinutes: T.task,
        once: true,
        effects: [{ kind: "setPersistent", flag: "easyMoneyJoined", value: true }],
      },
      { id: "try-withdraw-1", label: "Try to withdraw the reward", visibleWhen: [done(P, "do-task-1")], timeCostMinutes: T.tryWithdraw, once: true },
      deposit(0, "do-task-1", `Deposit ${dong(EM.depositsVnd[0])} VND to unlock level 2`),
      { id: "do-task-2", label: "Do level 2 tasks: rate 5 product pages", visibleWhen: [done(P, "deposit-1")], timeCostMinutes: T.task, once: true },
      { id: "try-withdraw-2", label: "Try to withdraw the balance", visibleWhen: [done(P, "do-task-2")], timeCostMinutes: T.tryWithdraw, once: true },
      deposit(1, "do-task-2", `Deposit ${dong(EM.depositsVnd[1])} VND for account verification`),
      { id: "do-task-3", label: "Do level 3 tasks: rate 8 product pages", visibleWhen: [done(P, "deposit-2")], timeCostMinutes: T.task, once: true },
      { id: "try-withdraw-3", label: "Try to withdraw the balance again", visibleWhen: [done(P, "do-task-3")], timeCostMinutes: T.tryWithdraw, once: true },
      { ...deposit(2, "try-withdraw-3", `Deposit ${dong(EM.depositsVnd[2])} VND for the withdrawal tax`), visibleWhen: [done(P, "try-withdraw-3"), { kind: "resourceAtLeast", resource: "cash", value: EM.depositsVnd[2] }] },
      {
        ...deposit(2, "try-withdraw-3", `Borrow ${dong(EM.depositsVnd[2])} VND from a loan app and deposit it`),
        id: "deposit-3-borrow",
        visibleWhen: [done(P, "try-withdraw-3"), { kind: "resourceAtMost", resource: "cash", value: EM.depositsVnd[2] - 1 }],
        allowDebt: true,
        effects: [...LOSS, { kind: "setPersistent", flag: "easyMoneyDeposited", value: true }, { kind: "setPersistent", flag: "debtFromScam", value: true }],
      },
      { id: "try-withdraw-4", label: "Try to withdraw once more", visibleWhen: [{ kind: "anyOf", conditions: [done(P, "deposit-3"), done(P, "deposit-3-borrow")] }], timeCostMinutes: T.tryWithdraw, once: true },
      {
        id: "save-records",
        label: "Take screenshots of the deposit history, the messages and the page address",
        visibleWhen: [done(P, "try-withdraw-1")],
        timeCostMinutes: T.saveRecords,
        once: true,
        effects: [
          { kind: "adjustResource", resource: "evidence", delta: 1 },
          { kind: "setPersistent", flag: "scamEvidenceSaved", value: true },
        ],
      },
      {
        id: "stop",
        label: "Stop and close the account",
        visibleWhen: [done(P, "do-task-1")],
        timeCostMinutes: T.stop,
        once: true,
        effects: [{ kind: "setPersistent", flag: "easyMoneyStopped", value: true }],
      },
    ],
  },
  {
    id: "file.company-check",
    app: "files",
    folder: "evidence",
    title: "Company lookup (saved)",
    body: "No registered company was found under the name QuickPay Tasks. The page lists no address, no tax number and no person to contact.",
    arrives: { when: [done(P, "check-company")] },
  },
  {
    id: "file.job-records",
    app: "files",
    folder: "evidence",
    title: "Job platform records (saved)",
    body: "Saved records of the job platform: the deposit history, the messages that asked for more deposits and the page address.",
    arrives: { when: [done(P, "save-records")] },
  },
  {
    id: "msg.job-minimum",
    app: "messages",
    title: "QuickPay Tasks",
    from: "QuickPay Tasks",
    body: `Withdrawals start at ${dong(EM.minimumWithdrawalVnd)} VND. Unlock level 2 with a deposit of ${dong(EM.depositsVnd[0])} VND. The deposit and your earnings come back together.`,
    arrives: { when: [done(P, "try-withdraw-1")] },
  },
  {
    id: "msg.job-verify",
    app: "messages",
    title: "QuickPay Tasks",
    from: "QuickPay Tasks",
    body: `Your balance reached the minimum, but the account must be verified before a withdrawal. Deposit ${dong(EM.depositsVnd[1])} VND. It is returned after the check.`,
    arrives: { when: [done(P, "try-withdraw-2")] },
  },
  {
    id: "msg.job-tax",
    app: "messages",
    title: "QuickPay Tasks",
    from: "QuickPay Tasks",
    body: `A withdrawal tax must be paid first. Deposit ${dong(EM.depositsVnd[2])} VND. It is returned with your balance.`,
    arrives: { when: [done(P, "try-withdraw-3")] },
  },
  {
    id: "msg.job-review",
    app: "messages",
    title: "QuickPay Tasks",
    from: "QuickPay Tasks",
    body: "Your account is under review for 30 days. Withdrawals are paused. Do not close the page.",
    arrives: { when: [done(P, "try-withdraw-4")] },
  },
  {
    id: "msg.job-countdown",
    app: "messages",
    title: "QuickPay Tasks",
    from: "QuickPay Tasks",
    body: "Level 2 tasks close soon. Deposit now to keep your bonus and your balance.",
    arrives: { when: [{ kind: "eventStatus", eventId: "m01.job-pressure", status: "resolved" }] },
  },
];

const EASY_MONEY_EVENTS: GameEventDef[] = [
  {
    id: "m01.job-pressure",
    title: "The job page asks you to hurry",
    body: "A message says that level 2 closes soon.",
    channel: "notification",
    autoResolve: true,
    optional: true,
    trigger: {
      afterAction: { itemId: P, actionId: "deposit-1", minutes: EM.pressureAfterMinutes },
      cancelledBy: [
        { itemId: P, actionId: "deposit-2" },
        { itemId: P, actionId: "stop" },
      ],
    },
    onFire: [{ kind: "deliverItem", itemId: "msg.job-countdown" }],
    responses: [],
  },
];

// ---------------------------------------------------------------------------------------------
// THE GOLDEN PLATFORM
// ---------------------------------------------------------------------------------------------

const G = "page.golden";
const GT = GP.minutes;
const gpLoss: Effect[] = [...LOSS, { kind: "setPersistent", flag: "investmentFundsLocked", value: true }, { kind: "setPersistent", flag: "goldenPlatformJoined", value: true }];

const fee = (index: 0 | 1 | 2, after: string, label: string): DeviceItemActionDef => ({
  id: `pay-fee-${index + 1}`,
  label,
  visibleWhen: [done(G, after)],
  timeCostMinutes: GT.fee,
  cashCost: GP.feesVnd[index],
  ledgerLabel: `ledger.invest-fee-${index + 1}`,
  ledgerCategory: "loss",
  counterparty: "The Golden Platform",
  once: true,
  effects: [...gpLoss, { kind: "setPersistent", flag: "goldenFeesPaid", value: true }],
});

const GOLDEN_ITEMS: DeviceItemDef[] = [
  {
    id: "msg.golden-friend",
    app: "messages",
    title: "Hung",
    from: "Hung (a friend of Minh's cousin)",
    body:
      "Hi Alex, I am Hung. My friend earns about 8% every week with the Golden Platform. I put money in last month and I already took profit out. " +
      "Join with my code and you get a new member bonus. The page: golden-platform-invest.com",
    arrives: { atMinute: MISSION_01_OFFERS_CONFIG.goldenPlatformAtMinute },
    actions: [
      {
        id: "ask-hung",
        label: "Ask Hung if the platform is licensed and where the profit comes from",
        timeCostMinutes: GT.ask,
        once: true,
        transcript: [
          { speaker: "alex", text: "Is the platform licensed? Where does the profit come from?" },
          { speaker: "other", text: "Do not worry, the manager is my relative. The profit comes from trading. Be quick, the new member bonus ends tonight." },
        ],
      },
      { id: "open-link", label: "Open the platform page", timeCostMinutes: GT.read, once: true },
      {
        id: "decline",
        label: "Tell Hung no thanks",
        timeCostMinutes: GT.decline,
        once: true,
        transcript: [
          { speaker: "alex", text: "Thank you Hung, but I do not invest money I need for rent." },
          { speaker: "other", text: "As you wish. The offer ends tonight." },
        ],
      },
    ],
  },
  {
    id: "contact.authority",
    app: "contacts",
    title: "Financial Supervision Office (official contact)",
    detail: "+000 100 0300",
    body: "The public information line of the financial supervisor. The number is printed in the bank's app.",
    actions: [
      {
        id: "call",
        label: "Call the Financial Supervision Office",
        visibleWhen: [arrived("msg.golden-friend")],
        timeCostMinutes: GT.authorityCall,
        once: true,
        transcript: [
          { speaker: "other", text: "Financial Supervision Office, public information line. How can I help?" },
          { speaker: "alex", text: "Hello. A friend of a friend invited me to an investment platform and I want to check it." },
        ],
      },
      {
        id: "ask-platform",
        label: "Ask if the Golden Platform is on the list of licensed firms",
        visibleWhen: [done("contact.authority", "call")],
        timeCostMinutes: GT.authorityAsk,
        once: true,
        transcript: [
          { speaker: "alex", text: "Is the Golden Platform on your list of licensed firms? It promises 8% every week." },
          {
            speaker: "other",
            text: "No firm with that name is on our public list. A fixed high return with no risk is a warning sign. Do not send money to a firm that is not on the list. You may report it to us and to your bank.",
          },
        ],
        effects: [{ kind: "adjustResource", resource: "evidence", delta: 1 }],
      },
    ],
  },
  {
    id: G,
    app: "mail",
    folder: "other",
    title: "The Golden Platform: member dashboard",
    from: "The Golden Platform",
    detail: "golden-platform-invest.com",
    body:
      "Grow your money with weekly profit. Join now and receive the new member bonus.\n\n" +
      "This page is a simulation. No real money, account or investment is used in this game.",
    arrives: { when: [done("msg.golden-friend", "open-link")] },
    figures: [
      {
        when: [done(G, "invest-more")],
        rows: [{ kind: "real" }, { kind: "shown", amountVnd: GP.shownVnd[2] }, { kind: "withdrawable", amountVnd: 0 }, { kind: "locked", amountVnd: GP.investVnd + GP.upgradeVnd }],
      },
      {
        when: [done(G, "check-dashboard")],
        rows: [{ kind: "real" }, { kind: "shown", amountVnd: GP.shownVnd[1] }, { kind: "withdrawable", amountVnd: 0 }, { kind: "locked", amountVnd: GP.investVnd }],
      },
      {
        when: [done(G, "invest")],
        rows: [{ kind: "real" }, { kind: "shown", amountVnd: GP.shownVnd[0] }, { kind: "withdrawable", amountVnd: 0 }, { kind: "locked", amountVnd: GP.investVnd }],
      },
      { rows: [{ kind: "real" }, { kind: "shown", amountVnd: 0 }, { kind: "withdrawable", amountVnd: 0 }, { kind: "locked", amountVnd: 0 }] },
    ],
    actions: [
      {
        id: "invest",
        label: `Invest ${dong(GP.investVnd)} VND in the starter plan`,
        timeCostMinutes: GT.invest,
        cashCost: GP.investVnd,
        ledgerLabel: "ledger.invest-1",
        ledgerCategory: "locked",
        counterparty: "The Golden Platform",
        once: true,
        effects: gpLoss,
      },
      { id: "check-dashboard", label: "Check the dashboard", visibleWhen: [done(G, "invest")], timeCostMinutes: GT.dashboard, once: true },
      {
        id: "invest-more",
        label: `Upgrade to the Gold plan with ${dong(GP.upgradeVnd)} VND for a higher rate`,
        visibleWhen: [done(G, "check-dashboard")],
        timeCostMinutes: GT.invest,
        cashCost: GP.upgradeVnd,
        ledgerLabel: "ledger.invest-2",
        ledgerCategory: "locked",
        counterparty: "The Golden Platform",
        once: true,
        effects: gpLoss,
      },
      { id: "withdraw-1", label: "Withdraw the profit shown on the dashboard", visibleWhen: [done(G, "check-dashboard")], timeCostMinutes: GT.withdraw, once: true },
      fee(0, "withdraw-1", `Pay the verification fee of ${dong(GP.feesVnd[0])} VND`),
      { id: "withdraw-2", label: "Withdraw again", visibleWhen: [done(G, "pay-fee-1")], timeCostMinutes: GT.withdraw, once: true },
      fee(1, "withdraw-2", `Pay the withdrawal tax of ${dong(GP.feesVnd[1])} VND`),
      { id: "withdraw-3", label: "Withdraw once more", visibleWhen: [done(G, "pay-fee-2")], timeCostMinutes: GT.withdraw, once: true },
      fee(2, "withdraw-3", `Pay the unfreeze fee of ${dong(GP.feesVnd[2])} VND`),
      { id: "withdraw-4", label: "Try to withdraw after the last fee", visibleWhen: [done(G, "pay-fee-3")], timeCostMinutes: GT.withdraw, once: true },
      {
        id: "save-records",
        label: "Take screenshots of the dashboard, the fee messages and the page address",
        visibleWhen: [done(G, "withdraw-1")],
        timeCostMinutes: GT.saveRecords,
        once: true,
        effects: [
          { kind: "adjustResource", resource: "evidence", delta: 1 },
          { kind: "setPersistent", flag: "scamEvidenceSaved", value: true },
        ],
      },
      { id: "leave", label: "Stop and leave the platform", timeCostMinutes: GT.leave, once: true },
    ],
  },
  {
    id: "file.golden-records",
    app: "files",
    folder: "evidence",
    title: "Investment platform records (saved)",
    body: "Saved records of the investment platform: the dashboard, the messages that asked for fees before a withdrawal and the page address.",
    arrives: { when: [done(G, "save-records")] },
  },
  {
    id: "msg.golden-fee-1",
    app: "messages",
    title: "The Golden Platform",
    from: "The Golden Platform",
    body: `To withdraw, a verification fee of ${dong(GP.feesVnd[0])} VND must be paid first. It is part of your balance.`,
    arrives: { when: [done(G, "withdraw-1")] },
  },
  {
    id: "msg.golden-fee-2",
    app: "messages",
    title: "The Golden Platform",
    from: "The Golden Platform",
    body: `Profit is taxed before it leaves the platform. Pay ${dong(GP.feesVnd[1])} VND to release your withdrawal.`,
    arrives: { when: [done(G, "withdraw-2")] },
  },
  {
    id: "msg.golden-fee-3",
    app: "messages",
    title: "The Golden Platform",
    from: "The Golden Platform",
    body: `Your account was flagged for a large withdrawal and is frozen. Pay ${dong(GP.feesVnd[2])} VND to unfreeze it.`,
    arrives: { when: [done(G, "withdraw-3")] },
  },
  {
    id: "msg.golden-frozen",
    app: "messages",
    title: "The Golden Platform",
    from: "The Golden Platform",
    body: "Your withdrawal is in review. It can take up to 30 days. Your funds stay locked until then.",
    arrives: { when: [done(G, "withdraw-4")] },
  },
  {
    id: "msg.golden-profit",
    app: "messages",
    title: "The Golden Platform",
    from: "The Golden Platform",
    body: "Your profit grew by 3% today. Invite friends and receive a bonus.",
    arrives: { when: [{ kind: "eventStatus", eventId: "m01.golden-profit-notice", status: "resolved" }] },
  },
];

const GOLDEN_EVENTS: GameEventDef[] = [
  {
    id: "m01.golden-profit-notice",
    title: "The platform shows more profit",
    body: "A message says that the profit on the dashboard grew.",
    channel: "notification",
    autoResolve: true,
    optional: true,
    trigger: {
      afterAction: { itemId: G, actionId: "invest", minutes: GP.profitNoticeAfterMinutes },
      cancelledBy: [{ itemId: G, actionId: "leave" }],
    },
    onFire: [{ kind: "deliverItem", itemId: "msg.golden-profit" }],
    responses: [],
  },
];

// ---------------------------------------------------------------------------------------------
// The two optional missions
// ---------------------------------------------------------------------------------------------

// Task steps of the two offers. Neutral wording: the step never says whether an offer is honest.
const readStep = (itemId: string, label: string): MissionStepDef => ({
  id: "read",
  label,
  target: "phone",
  app: "messages",
  doneWhen: [{ kind: "itemOpened", itemId }],
});
/** No `doneWhen`: it stays open until the player's choice ends the mission. */
const decideStep = (label: string, target: MissionStepDef["target"], app: MissionStepDef["app"]): MissionStepDef => ({ id: "decide", label, target, app });

const MISSIONS: MissionDef[] = [
  {
    id: "m01.easy-money",
    title: "EASY MONEY",
    optional: true,
    opensWhen: { atMinute: MISSION_01_OFFERS_CONFIG.easyMoneyAtMinute },
    completeWhen: [{ kind: "anyOf", conditions: [done(P, "stop"), done("msg.easy-money", "decline")] }],
    paths: [
      {
        id: "deposited",
        when: [{ kind: "persistent", flag: "easyMoneyDeposited", value: true }],
        objective: "Money has left your account for this job. The balance on the page is not money you can withdraw.",
        steps: [decideStep("Decide what to do next with the job", "laptop", "jobs")],
      },
      {
        id: "working",
        when: [done(P, "do-task-1")],
        objective: "The job page shows a small reward and asks for a deposit to go on.",
        steps: [decideStep("Decide whether to go on with the job", "laptop", "jobs")],
      },
      {
        id: "offer",
        when: [],
        objective: "A student told you about an online job. You can ask, check it, try it or say no.",
        steps: [readStep("msg.easy-money", "Read the message about the online job"), decideStep("Decide what to do with the job offer", "phone", "messages")],
      },
    ],
  },
  {
    id: "m01.golden-platform",
    title: "THE GOLDEN PLATFORM",
    optional: true,
    opensWhen: { atMinute: MISSION_01_OFFERS_CONFIG.goldenPlatformAtMinute },
    completeWhen: [{ kind: "anyOf", conditions: [done(G, "leave"), done("msg.golden-friend", "decline")] }],
    paths: [
      {
        id: "locked",
        when: [{ kind: "persistent", flag: "investmentFundsLocked", value: true }],
        objective: "The money you sent is locked. Every withdrawal asks for a new fee.",
        steps: [decideStep("Decide what to do about the locked money", "laptop", "mail")],
      },
      {
        id: "offer",
        when: [],
        objective: "An acquaintance invited you to an investment platform. You can ask, check it, join or say no.",
        steps: [readStep("msg.golden-friend", "Read the invitation to the investment platform"), decideStep("Decide whether to join the platform", "phone", "messages")],
      },
    ],
  },
];

/**
 * Once the player stops (closes the account or leaves the platform) nothing on that page goes on: no
 * task, deposit, investment, withdrawal or fee is offered any more. Only the checks and the saved
 * records stay, because they use no money and the player may still want them.
 */
const closesOn = (item: DeviceItemDef, exitActionId: string, staysOpen: readonly string[]): DeviceItemDef => ({
  ...item,
  actions: item.actions?.map((action) =>
    action.id === exitActionId || staysOpen.includes(action.id)
      ? action
      : { ...action, visibleWhen: [...(action.visibleWhen ?? []), { kind: "not" as const, condition: done(item.id, exitActionId) }] },
  ),
});

export const MISSION_01_OFFERS_DEVICE_ITEMS: DeviceItemDef[] = [...EASY_MONEY_ITEMS, ...GOLDEN_ITEMS].map((item) => {
  if (item.id === P) return closesOn(item, "stop", ["check-company", "save-records"]);
  if (item.id === G) return closesOn(item, "leave", ["save-records"]);
  return item;
});
export const MISSION_01_OFFERS_EVENTS: GameEventDef[] = [...EASY_MONEY_EVENTS, ...GOLDEN_EVENTS];
export const MISSION_01_OFFERS_MISSIONS: MissionDef[] = MISSIONS;
