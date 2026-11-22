// The look-alike "graduation clearance" site that the story's email links to, in the in-game
// browser. It is a simulation for the game: it reuses the school's name and colors the way a
// look-alike site would, and it sits on an address that is not the portal's. Nothing on it is a
// verdict: no label, no warning color. The player can notice the differences (the address, the
// office's name, the contact numbers, the fee that the portal does not list) or not.
//
// Everything it does goes through the story's own item `page.fee`: signing in, paying and the
// verification code are three separate core actions, taken by three separate buttons on three
// separate pages, each after the player filled the form with the game's fictional details. Filling a
// form and moving between pages change nothing in the story. No value typed or filled here leaves the
// game, and no password, card or code is ever real.
import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, CircleUserRound, CreditCard, KeyRound, MessageSquare, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DeviceActionView, DeviceItemView, DeviceView } from "../../../../../../game/narrative/device";
import { MISSION_01_CONFIG } from "../../../../../../game/narrative/chapter1/mission01";
import { useGameLocale } from "../../../../../../i18n/useGameLocale";
import { formatAmount, type Tx } from "../../../../device/deviceFormat";
import { hostOf, isWebPageItem, linksOf } from "../../mailModel";
import { Notice } from "../BrowserPages";
import { canonicalPageUrl, urlOfPage, type ClearanceStep, type VirtualPage } from "../sites";
import { canonicalAddress } from "../urls";
import { Breadcrumbs, Card, GameField, siteButtonClass } from "./siteUi";
import { CLEARANCE_COLORS as C, GAME_PROFILE } from "./uehTheme";
import { UehMark } from "./UehMark";

export interface ClearanceSiteProps {
  page: VirtualPage;
  step: ClearanceStep;
  view: DeviceView;
  /** What the player filled into this tab's forms. */
  fields: Readonly<Record<string, string>>;
  setFields: (fields: Readonly<Record<string, string>>) => void;
  go: (url: string) => void;
  onOpenItem: (itemId: string) => void;
  onUseItem: (itemId: string, actionId: string) => void;
}

const STEPS: readonly ClearanceStep[] = ["login", "payment", "verify"];


export const ClearanceSite: React.FC<ClearanceSiteProps> = ({ page, step, view, fields, setFields, go, onOpenItem, onUseItem }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const locale = useGameLocale();
  // A wrong one-time code shows an error under the field, like the real page would.
  const [codeWrong, setCodeWrong] = useState(false);

  // The story's page item and the mail that links to it.
  const host = hostOf(page.url);
  const item: DeviceItemView | null = view.apps.mail.find((entry) => isWebPageItem(entry) && (entry.detail ?? "").toLowerCase() === host) ?? null;
  const source = view.apps.mail.find(
    (entry) => !isWebPageItem(entry) && linksOf(entry.body).some((link) => canonicalPageUrl(canonicalAddress(link)) === urlOfPage("fee")) && entry.actions.some((action) => action.id === "open-link"),
  );
  const loadAction = source?.actions.find((action) => action.id === "open-link" && action.available) ?? null;

  // Following the mail's link IS the story's "open the payment link" step (it costs a few minutes and
  // nothing else), so the page opens by itself once. Opening the page has no other effect.
  const requested = useRef(false);
  const onUseRef = useRef(onUseItem);
  onUseRef.current = onUseItem;
  useEffect(() => {
    if (item === null && source !== undefined && loadAction !== null && !requested.current) {
      requested.current = true;
      onUseRef.current(source.id, loadAction.id);
    }
  }, [item, source, loadAction]);

  // Seeing the page marks it read, as opening it from a list used to.
  const itemId = item?.id ?? null;
  const itemRead = item?.read ?? true;
  const onOpenRef = useRef(onOpenItem);
  onOpenRef.current = onOpenItem;
  useEffect(() => {
    if (itemId !== null && !itemRead) onOpenRef.current(itemId);
  }, [itemId, itemRead]);

  if (item === null) {
    if (source !== undefined && loadAction !== null) return <div className="min-h-full" aria-busy="true" data-testid="clearance-opening" />;
    return <Notice testId="browser-unavailable" icon="alert" title={t("laptop.browser.unavailable.title")} body={t("laptop.browser.unavailable.body")} />;
  }

  const action = (id: string): DeviceActionView | null => item.actions.find((entry) => entry.id === id) ?? null;
  const signIn = action("sign-in");
  const payCard = action("pay-card");
  const enterCode = action("enter-code");
  const signedIn = signIn?.blocked === "done";
  const paid = payCard?.blocked === "done";
  const verified = enterCode?.blocked === "done";
  const fee = formatAmount(locale, MISSION_01_CONFIG.clearanceFeeVnd);
  const blockedText = (entry: DeviceActionView | null): string | null => (entry !== null && entry.blocked !== null && entry.blocked !== "done" ? t(`device.blocked.${entry.blocked}`) : null);

  const stepIndex = STEPS.indexOf(step);
  const crumbs = [
    { label: t("ueh.clearance.home") },
    { label: t("ueh.clearance.graduation"), onClick: step === "notice" ? undefined : () => go(urlOfPage("fee")) },
    { label: t(`ueh.clearance.crumb.${step}`) },
  ];

  const stepper = stepIndex >= 0 && (
    <ol className="mb-4 flex items-center gap-2 text-xs" aria-label={t("ueh.clearance.stepsLabel")} data-testid="clearance-steps">
      {STEPS.map((id, index) => (
        <li key={id} className="flex items-center gap-2" aria-current={index === stepIndex ? "step" : undefined}>
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
            style={{ background: index <= stepIndex ? C.teal : C.tealSoft, color: index <= stepIndex ? C.white : C.muted }}
          >
            {index + 1}
          </span>
          <span style={{ color: index === stepIndex ? C.ink : C.muted, fontWeight: index === stepIndex ? 700 : 500 }}>{t(`ueh.clearance.step.${id}`)}</span>
          {index < STEPS.length - 1 && <span aria-hidden="true" className="h-px w-5" style={{ background: C.line }} />}
        </li>
      ))}
    </ol>
  );

  const fill = (values: Record<string, string>) => setFields({ ...fields, ...values });
  const field = (key: string) => fields[key] ?? "";
  const setField = (key: string) => (value: string) => fill({ [key]: value });
  const fillLogin = () => fill({ "login.id": GAME_PROFILE.studentId, "login.password": GAME_PROFILE.passwordMask });
  const loginSuggestions = [{ testId: "login-fill", primary: GAME_PROFILE.studentId, secondary: GAME_PROFILE.passwordMask, onPick: fillLogin }];
  const fillCard = () => fill({ "pay.holder": GAME_PROFILE.cardHolder, "pay.number": GAME_PROFILE.cardNumber, "pay.expiry": GAME_PROFILE.cardExpiry });
  const cardSuggestions = [
    {
      testId: "pay-fill",
      primary: t("ueh.clearance.cardSuggestion", { brand: GAME_PROFILE.cardBrand, last4: GAME_PROFILE.cardLast4 }),
      secondary: t("ueh.clearance.cardSuggestionDetail", { holder: GAME_PROFILE.cardHolder, expiry: GAME_PROFILE.cardExpiry }),
      onPick: fillCard,
    },
  ];
  const code = MISSION_01_CONFIG.paymentCode;
  // The bank's text has arrived: the browser offers its code, as it does with a phone nearby.
  const codeArrived = Object.values(view.apps).some((items) => items.some((entry) => entry.id === "msg.bank-code"));
  const codeSuggestions = codeArrived
    ? [{ testId: "verify-fill", primary: t("ueh.clearance.codeSuggestion", { code }), onPick: () => { setCodeWrong(false); fill({ "verify.code": code }); } }]
    : [];

  let body: React.ReactNode;
  if (step === "notice") {
    body = (
      <div className="space-y-4" data-testid="fake-step-notice">
        <Card colors={C} accent title={t("ueh.clearance.noticeTitle")} icon={<ShieldAlert className="h-4 w-4" aria-hidden="true" />}>
          <p className="text-sm" style={{ color: C.ink }}>
            {t("ueh.clearance.noticeBody")}
          </p>
        </Card>
        <Card colors={C} title={t("ueh.clearance.feeTitle")}>
          <dl>
            <div className="flex items-baseline justify-between gap-3 border-b py-1.5" style={{ borderColor: C.line }}>
              <dt className="text-xs" style={{ color: C.muted }}>
                {t("ueh.clearance.feeName")}
              </dt>
              <dd className="text-lg font-bold tabular-nums" style={{ color: C.ink }} data-testid="clearance-fee">
                {t("ueh.clearance.feeAmount", { amount: fee })}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-1.5">
              <dt className="text-xs" style={{ color: C.muted }}>
                {t("ueh.clearance.deadlineLabel")}
              </dt>
              <dd className="text-sm font-bold" style={{ color: "#8a4b00" }}>
                {t("ueh.clearance.deadlineValue")}
              </dd>
            </div>
          </dl>
          <p className="mt-1 text-xs" style={{ color: C.muted }}>
            {t("ueh.clearance.deadlineNote")}
          </p>
        </Card>
        <button type="button" className={siteButtonClass("accent")} data-testid="clearance-continue" onClick={() => go(urlOfPage("fee-login"))}>
          {t("ueh.clearance.continue")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  } else if (step === "login") {
    const ready = field("login.id") !== "" && field("login.password") !== "";
    const reason = blockedText(signIn);
    body = (
      <div className="space-y-4" data-testid="fake-step-login">
        {stepper}
        <Card colors={C} title={t("ueh.clearance.loginTitle")} icon={<CircleUserRound className="h-4 w-4" aria-hidden="true" />}>
          <p className="mb-3 text-xs" style={{ color: C.muted }}>
            {t("ueh.clearance.loginBody")}
          </p>
          <div className="space-y-3">
            <GameField
              colors={C}
              id="login-id"
              label={t("ueh.clearance.studentId")}
              value={field("login.id")}
              onChange={setField("login.id")}
              typesAs={GAME_PROFILE.studentId}
              suggestionsLabel={t("ueh.clearance.savedPasswords")}
              suggestionsIcon={<KeyRound className="h-3 w-3" aria-hidden="true" />}
              suggestions={loginSuggestions}
            />
            <GameField
              colors={C}
              id="login-password"
              label={t("ueh.clearance.password")}
              value={field("login.password")}
              onChange={setField("login.password")}
              typesAs={GAME_PROFILE.passwordMask}
              secret
              suggestionsLabel={t("ueh.clearance.savedPasswords")}
              suggestionsIcon={<KeyRound className="h-3 w-3" aria-hidden="true" />}
              suggestions={loginSuggestions.map((entry) => ({ ...entry, testId: "login-fill-password" }))}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {signedIn ? (
              <button type="button" className={siteButtonClass("primary")} data-testid="login-next" onClick={() => go(urlOfPage("fee-payment"))}>
                {t("ueh.clearance.continue")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                className={siteButtonClass("primary")}
                disabled={!ready || signIn === null || !signIn.available}
                data-testid="login-submit"
                onClick={() => {
                  if (signIn === null) return;
                  onUseItem(item.id, signIn.id);
                  go(urlOfPage("fee-payment"));
                }}
              >
                {t("ueh.clearance.signIn")}
              </button>
            )}
          </div>
          {reason && (
            <p className="mt-2 text-xs" style={{ color: C.muted }}>
              {reason}
            </p>
          )}
        </Card>
      </div>
    );
  } else if (step === "payment") {
    if (!signedIn) {
      body = (
        <Card colors={C} title={t("ueh.clearance.needLoginTitle")} testId="fake-step-needlogin">
          <p className="text-sm" style={{ color: C.ink }}>
            {t("ueh.clearance.needLoginBody")}
          </p>
          <button type="button" className={`${siteButtonClass("primary")} mt-3`} onClick={() => go(urlOfPage("fee-login"))}>
            {t("ueh.clearance.goToLogin")}
          </button>
        </Card>
      );
    } else {
      const ready = field("pay.holder") !== "" && field("pay.number") !== "" && field("pay.expiry") !== "" && field("pay.cvc") !== "";
      const reason = blockedText(payCard);
      body = (
        <div className="space-y-4" data-testid="fake-step-payment">
          {stepper}
          <Card colors={C} title={t("ueh.clearance.paymentTitle")} icon={<CreditCard className="h-4 w-4" aria-hidden="true" />}>
            <p className="mb-3 text-xs" style={{ color: C.muted }}>
              {t("ueh.clearance.paymentBody", { amount: fee })}
            </p>
            <div className="space-y-3">
              <GameField
                colors={C}
                id="pay-number"
                label={t("ueh.clearance.cardNumber")}
                value={field("pay.number")}
                onChange={setField("pay.number")}
                typesAs={GAME_PROFILE.cardNumber}
                placeholder="1234 5678 9012 3456"
                suggestionsLabel={t("ueh.clearance.savedCards")}
                suggestionsIcon={<CreditCard className="h-3 w-3" aria-hidden="true" />}
                suggestions={cardSuggestions}
              />
              <GameField colors={C} id="pay-holder" label={t("ueh.clearance.cardHolder")} value={field("pay.holder")} onChange={setField("pay.holder")} typesAs={GAME_PROFILE.cardHolder} />
              <div className="grid grid-cols-2 gap-3">
                <GameField colors={C} id="pay-expiry" label={t("ueh.clearance.cardExpiry")} value={field("pay.expiry")} onChange={setField("pay.expiry")} typesAs={GAME_PROFILE.cardExpiry} placeholder="MM/YY" />
                <GameField colors={C} id="pay-cvc" label={t("ueh.clearance.cardCvc")} value={field("pay.cvc")} onChange={setField("pay.cvc")} typesAs={GAME_PROFILE.cardCvc} secret placeholder="CVC" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {paid ? (
                <button type="button" className={siteButtonClass("primary")} data-testid="pay-next" onClick={() => go(urlOfPage("fee-verify"))}>
                  {t("ueh.clearance.continue")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  className={siteButtonClass("accent")}
                  disabled={!ready || payCard === null || !payCard.available}
                  data-testid="pay-submit"
                  onClick={() => {
                    if (payCard === null) return;
                    onUseItem(item.id, payCard.id);
                    go(urlOfPage("fee-verify"));
                  }}
                >
                  {t("ueh.clearance.pay", { amount: fee })}
                </button>
              )}
            </div>
            {reason && (
              <p className="mt-2 text-xs" style={{ color: C.muted }}>
                {reason}
              </p>
            )}
          </Card>
        </div>
      );
    }
  } else if (step === "verify") {
    if (!paid) {
      body = (
        <Card colors={C} title={t("ueh.clearance.needPaymentTitle")} testId="fake-step-needpayment">
          <p className="text-sm" style={{ color: C.ink }}>
            {t("ueh.clearance.needPaymentBody")}
          </p>
          <button type="button" className={`${siteButtonClass("primary")} mt-3`} onClick={() => go(urlOfPage(signedIn ? "fee-payment" : "fee-login"))}>
            {t("ueh.clearance.back")}
          </button>
        </Card>
      );
    } else {
      const ready = field("verify.code").length === code.length;
      body = (
        <div className="space-y-4" data-testid="fake-step-verify">
          {stepper}
          <Card colors={C} title={t("ueh.clearance.verifyTitle")} icon={<KeyRound className="h-4 w-4" aria-hidden="true" />}>
            <p className="mb-3 text-xs" style={{ color: C.muted }}>
              {t("ueh.clearance.verifyBody", { amount: fee })}
            </p>
            <GameField
              colors={C}
              id="verify-code"
              label={t("ueh.clearance.code")}
              value={field("verify.code")}
              onChange={(value) => {
                setCodeWrong(false);
                fill({ "verify.code": value });
              }}
              freeDigits={code.length}
              placeholder={"\u2022".repeat(code.length)}
              suggestionsLabel={t("ueh.clearance.fromMessages")}
              suggestionsIcon={<MessageSquare className="h-3 w-3" aria-hidden="true" />}
              suggestions={codeSuggestions}
              invalid={codeWrong ? t("ueh.clearance.codeWrong") : null}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {verified ? (
                <button type="button" className={siteButtonClass("primary")} data-testid="verify-next" onClick={() => go(urlOfPage("fee-complete"))}>
                  {t("ueh.clearance.continue")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  className={siteButtonClass("accent")}
                  disabled={!ready || enterCode === null || !enterCode.available}
                  data-testid="verify-submit"
                  onClick={() => {
                    if (enterCode === null) return;
                    // Only the code from the bank's text goes through, as on a real page.
                    if (field("verify.code") !== code) {
                      setCodeWrong(true);
                      return;
                    }
                    onUseItem(item.id, enterCode.id);
                    go(urlOfPage("fee-complete"));
                  }}
                >
                  {t("ueh.clearance.confirm")}
                </button>
              )}
            </div>
            {blockedText(enterCode) && (
              <p className="mt-2 text-xs" style={{ color: C.muted }}>
                {blockedText(enterCode)}
              </p>
            )}
          </Card>
        </div>
      );
    }
  } else {
    body = verified ? (
      <Card colors={C} title={t("ueh.clearance.doneTitle")} testId="fake-step-complete">
        <p className="text-sm" style={{ color: C.ink }}>
          {t("ueh.clearance.doneBody")}
        </p>
      </Card>
    ) : (
      <Card colors={C} title={t("ueh.clearance.notDoneTitle")} testId="fake-step-notdone">
        <p className="text-sm" style={{ color: C.ink }}>
          {t("ueh.clearance.notDoneBody")}
        </p>
        <button type="button" className={`${siteButtonClass("primary")} mt-3`} onClick={() => go(urlOfPage("fee"))}>
          {t("ueh.clearance.back")}
        </button>
      </Card>
    );
  }

  return (
    <div className="flex min-h-full flex-col" data-testid="clearance-site" data-step={step} style={{ background: C.page, color: C.ink }}>
      <header className="shrink-0" style={{ background: C.white, borderBottom: `3px solid ${C.orange}` }}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
          <UehMark colors={C} />
          <span className="text-sm font-bold" style={{ color: C.tealDark }}>
            {t("ueh.clearance.siteTitle")}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 px-4 py-1.5 text-xs font-medium" style={{ background: C.teal, color: C.white }} data-testid="clearance-nav">
          {(["home", "graduation", "thesis", "support"] as const).map((key) => (
            <span key={key}>{t(`ueh.clearance.nav.${key}`)}</span>
          ))}
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 space-y-4 p-4">
        <Breadcrumbs colors={C} items={crumbs} />
        {body}
      </main>
      <footer className="shrink-0 space-y-0.5 border-t px-4 py-3 text-xs" style={{ borderColor: C.line, background: C.white, color: C.muted }} data-testid="clearance-footer">
        <p className="font-semibold" style={{ color: C.tealDark }}>
          {t("ueh.clearance.footerOffice")}
        </p>
        <p>{t("ueh.clearance.footerContact")}</p>
        <p>{t("ueh.clearance.footerCopyright")}</p>
        <p>{t("ueh.brand.simNote")}</p>
      </footer>
    </div>
  );
};
