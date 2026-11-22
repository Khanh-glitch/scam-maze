// Mail client of the laptop desktop: an inbox with read and unread messages, a reader with sender
// details and visible links, folders and a Back to Inbox button. Light theme (blue and white).
//
// What it does to the game: opening a message that was unread calls `onOpenItem` (the same core
// action the old mail list used), which sets the read state. Opening a message never pays, signs in
// or sends anything. A link in a message asks the desktop to open the Browser window
// (`useDesktopNav().openBrowser`); it is a button, never an `<a href>`, and following it changes no
// game state by itself. Messages carry no warning colors or labels: the player decides what to trust.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Flag, Inbox, MousePointerClick, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DeviceAppId } from "../../../../../game/narrative/types";
import type { DeviceItemView, DeviceView } from "../../../../../game/narrative/device";
import { useGameLocale } from "../../../../../i18n/useGameLocale";
import { actionLabel, formatWhen, type Tx } from "../../../device/deviceFormat";
import { avatarColor, themeFor } from "../desktopTheme";
import { useDesktopNav } from "../desktopNav";
import { MAIL_ALL, isWebPageItem, mailFolders, mailPreview, messagesIn, parseSender, splitBody, unreadCount } from "../mailModel";

export interface MailClientProps {
  view: DeviceView;
  onOpenItem: (itemId: string) => void;
  onUseItem: (itemId: string, actionId: string) => void;
  onView?: (view: { app: DeviceAppId; itemIds: readonly string[] } | null) => void;
}

const INK = "#14233d";
const MUTED = "#5a6b85";
const LINE = "#dbe4f1";
const SURFACE = "#f6f9fd";
/** Below this width the list and the reader share the window (Back to Inbox); above it they sit side by side. */
const WIDE_PX = 620;

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]";
/** Icons of message actions in the reader's toolbar; other actions use a generic one. */
const ACTION_ICONS: Readonly<Record<string, LucideIcon>> = { "save-record": Flag };
const BUTTON_TOOL = `inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-[#14233d] motion-safe:transition-colors hover:bg-[#e6eefb] disabled:cursor-default disabled:text-[#6b7b95] disabled:hover:bg-transparent ${FOCUS}`;
const BUTTON_QUIET = `inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#cdd9ec] bg-white px-3 py-1.5 text-sm font-medium text-[#14233d] motion-safe:transition-colors hover:bg-[#eef3fb] ${FOCUS}`;

function useIsWide(ref: React.RefObject<HTMLElement | null>): boolean {
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setWide(el.clientWidth >= WIDE_PX);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return wide;
}

const Avatar: React.FC<{ name: string; initials: string; size?: "sm" | "md" }> = ({ name, initials, size = "md" }) => (
  <span
    aria-hidden="true"
    className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${size === "md" ? "h-9 w-9 text-sm" : "h-8 w-8 text-xs"}`}
    style={{ background: avatarColor(name) }}
  >
    {initials}
  </span>
);

export const MailClient: React.FC<MailClientProps> = ({ view, onOpenItem, onUseItem, onView }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const localeCode = useGameLocale();
  const nav = useDesktopNav();
  const theme = themeFor("device-mail");
  const rootRef = useRef<HTMLDivElement>(null);
  const wide = useIsWide(rootRef);

  const messages = view.apps.mail.filter((item) => !isWebPageItem(item));
  const folders = mailFolders(messages);
  const [folder, setFolder] = useState<string>(MAIL_ALL);
  const activeFolder = folder === MAIL_ALL || folders.includes(folder) ? folder : MAIL_ALL;
  const shown = messagesIn(messages, activeFolder);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const current = selectedId === null ? null : (messages.find((item) => item.id === selectedId) ?? null);
  const [senderOpen, setSenderOpen] = useState(false);
  const [linkPreview, setLinkPreview] = useState<string | null>(null);

  const showList = wide || current === null;
  const showReader = wide || current !== null;

  // Tell the voice which list is on screen (the same signal the old mail list gave).
  const onViewRef = useRef(onView);
  onViewRef.current = onView;
  const listIds = showList ? shown.map((item) => item.id).join("|") : null;
  useEffect(() => {
    if (listIds === null) return undefined;
    onViewRef.current?.({ app: "mail", itemIds: listIds === "" ? [] : listIds.split("|") });
    return () => onViewRef.current?.(null);
  }, [listIds]);

  const open = (item: DeviceItemView) => {
    setSelectedId(item.id);
    setSenderOpen(false);
    setLinkPreview(null);
    if (!item.read) onOpenItem(item.id);
  };
  const backToInbox = () => {
    setSelectedId(null);
    setLinkPreview(null);
  };

  const unread = unreadCount(messages);
  const folderName = (name: string) => (name === MAIL_ALL ? t("device.folders.all") : knownFolder(t, name));

  const renderList = () => (
    <section
      aria-label={t("laptop.mail.messagesLabel")}
      data-testid="mail-list"
      className={`flex min-h-0 flex-col overflow-y-auto ${wide ? "w-[19rem] shrink-0 border-r" : "w-full"}`}
      style={{ borderColor: LINE, background: "#ffffff" }}
    >
      {shown.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center" data-testid="mail-empty">
          <Inbox className="h-8 w-8" style={{ color: "#9db0cc" }} aria-hidden="true" />
          <p className="text-sm" style={{ color: MUTED }}>
            {t("laptop.mail.emptyFolder")}
          </p>
        </div>
      ) : (
        <ul>
          {shown.map((item) => {
            const sender = parseSender(item.from);
            const isUnread = item.tracksUnread && !item.read;
            const selected = current?.id === item.id;
            return (
              <li key={item.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                <button
                  type="button"
                  data-testid={`mail-row-${item.id}`}
                  data-unread={isUnread ? "true" : "false"}
                  aria-current={selected ? "true" : undefined}
                  onClick={() => open(item)}
                  className={`flex w-full cursor-pointer items-start gap-3 px-3 py-3 text-left motion-safe:transition-colors hover:bg-[#f0f5fd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2563eb] ${
                    selected ? "bg-[#e6efff]" : ""
                  }`}
                >
                  <Avatar name={sender.name} initials={sender.initials} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-sm ${isUnread ? "font-bold" : "font-medium"}`} style={{ color: INK }}>
                        {sender.name}
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-[11px]" style={{ color: MUTED }}>
                        {formatWhen(t, item.arrivedAtMinute)}
                      </span>
                    </span>
                    <span className={`block truncate text-[13px] ${isUnread ? "font-semibold" : ""}`} style={{ color: INK }}>
                      {item.title}
                    </span>
                    <span className="block truncate text-xs" style={{ color: MUTED }}>
                      {mailPreview(item.body)}
                    </span>
                  </span>
                  {isUnread && (
                    <>
                      <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: theme.accent }} />
                      <span className="sr-only">{t("device.unreadMark")}</span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const renderReader = () => {
    if (current === null) {
      return (
        <section
          aria-label={t("laptop.mail.readerLabel")}
          className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-2 p-8 text-center"
          style={{ background: SURFACE }}
          data-testid="mail-reader-empty"
        >
          <Inbox className="h-8 w-8" style={{ color: "#9db0cc" }} aria-hidden="true" />
          <p className="text-sm" style={{ color: MUTED }}>
            {t("laptop.mail.selectPrompt")}
          </p>
        </section>
      );
    }
    const sender = parseSender(current.from);
    const segments = splitBody(current.body);
    const hasLink = segments.some((segment) => segment.kind === "link");
    // The link opens the browser; the "open the link" step of the story is taken there, not here.
    const actions = current.actions.filter((action) => !(hasLink && action.id === "open-link"));
    return (
      <article
        aria-label={t("laptop.mail.readerLabel")}
        data-testid={`mail-message-${current.id}`}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
        style={{ background: "#ffffff" }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" data-testid="mail-reader-scroll">
          {!wide && (
            <button type="button" className={`${BUTTON_QUIET} mb-3`} onClick={backToInbox} data-testid="mail-back">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("laptop.mail.backToInbox")}
            </button>
          )}
          {actions.length > 0 && (
            // Like a real mail app: what you can do with a message sits in a toolbar above it.
            <div role="toolbar" aria-label={t("laptop.mail.toolbar")} data-testid="mail-toolbar" className="-mx-2 mb-3 flex flex-wrap items-center gap-1 border-b pb-2" style={{ borderColor: LINE }}>
              {actions.map((action) => {
                const Icon = action.blocked === "done" ? Check : (ACTION_ICONS[action.id] ?? MousePointerClick);
                return (
                  <button
                    key={action.id}
                    type="button"
                    className={BUTTON_TOOL}
                    disabled={!action.available}
                    data-testid={`device-action-${current.id}-${action.id}`}
                    title={action.blocked !== null && action.blocked !== "done" ? t(`device.blocked.${action.blocked}`) : actionLabel(t, localeCode, action)}
                    onClick={() => onUseItem(current.id, action.id)}
                  >
                    <Icon className={`h-4 w-4 ${action.blocked === "done" ? "text-[#15803d]" : ""}`} aria-hidden="true" />
                    {action.blocked === "done" ? t("laptop.mail.actionDone", { label: action.label }) : actionLabel(t, localeCode, action)}
                  </button>
                );
              })}
            </div>
          )}
          <h3 className="break-words text-lg font-bold leading-snug" style={{ color: INK }}>
            {current.title}
          </h3>
          <div className="mt-3 flex items-start gap-3">
            <Avatar name={sender.name} initials={sender.initials} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" style={{ color: INK }}>
                {sender.name}
              </p>
              <p className="break-all text-xs" style={{ color: MUTED }} data-testid="mail-sender-address">
                {sender.address ?? current.from ?? ""}
              </p>
              <p className="text-xs" style={{ color: MUTED }}>
                {t("laptop.mail.to")}
              </p>
            </div>
            <time className="shrink-0 text-right text-xs" style={{ color: MUTED }}>
              {formatWhen(t, current.arrivedAtMinute)}
            </time>
          </div>
          <button
            type="button"
            aria-expanded={senderOpen}
            aria-controls="mail-sender-details"
            data-testid="mail-sender-toggle"
            className={`mt-2 inline-flex cursor-pointer items-center gap-1 rounded text-xs font-medium text-[#1d4ed8] hover:underline ${FOCUS}`}
            onClick={() => setSenderOpen((value) => !value)}
          >
            {senderOpen ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
            {senderOpen ? t("laptop.mail.hideSenderDetails") : t("laptop.mail.senderDetails")}
          </button>
          {senderOpen && (
            <dl
              id="mail-sender-details"
              data-testid="mail-sender-details"
              className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: LINE, background: SURFACE }}
            >
              <dt style={{ color: MUTED }}>{t("laptop.mail.senderName")}</dt>
              <dd className="break-words font-medium" style={{ color: INK }}>
                {sender.name}
              </dd>
              <dt style={{ color: MUTED }}>{t("laptop.mail.senderAddress")}</dt>
              <dd className="break-all font-medium" style={{ color: INK }} data-testid="mail-detail-address">
                {sender.address ?? t("laptop.mail.noAddress")}
              </dd>
              <dt style={{ color: MUTED }}>{t("laptop.mail.senderDomain")}</dt>
              <dd className="break-all font-medium" style={{ color: INK }} data-testid="mail-detail-domain">
                {sender.domain ?? t("laptop.mail.noAddress")}
              </dd>
            </dl>
          )}
          <hr className="my-4" style={{ borderColor: LINE }} />
          <div className="whitespace-pre-line break-words text-sm leading-relaxed" style={{ color: INK }} data-testid="mail-body">
            {segments.map((segment, index) =>
              segment.kind === "text" ? (
                <React.Fragment key={index}>{segment.text}</React.Fragment>
              ) : nav ? (
                <button
                  key={index}
                  type="button"
                  data-testid="mail-link"
                  aria-label={t("laptop.mail.openLink", { url: segment.url })}
                  className={`cursor-pointer break-all rounded-sm text-left align-baseline text-[#1d4ed8] underline underline-offset-2 hover:text-[#1e40af] ${FOCUS}`}
                  onPointerEnter={() => setLinkPreview(segment.url)}
                  onPointerLeave={() => setLinkPreview(null)}
                  onFocus={() => setLinkPreview(segment.url)}
                  onBlur={() => setLinkPreview(null)}
                  onClick={() => nav.openBrowser({ url: segment.url })}
                >
                  {segment.url}
                </button>
              ) : (
                <span key={index} data-testid="mail-link-text" className="break-all text-[#1d4ed8] underline underline-offset-2">
                  {segment.url}
                </span>
              ),
            )}
          </div>
        </div>
        <div
          aria-live="polite"
          className="min-h-7 shrink-0 truncate border-t px-4 py-1 text-xs"
          style={{ borderColor: LINE, background: SURFACE, color: MUTED }}
          data-testid="mail-link-status"
        >
          {linkPreview === null ? "" : t("laptop.mail.linkAddress", { url: linkPreview })}
        </div>
      </article>
    );
  };

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col" data-testid="mail-client" style={{ background: theme.bodyBg, color: INK }}>
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5" style={{ borderColor: LINE, background: SURFACE }}>
        <h3 className="flex items-center gap-2 text-sm font-bold" style={{ color: INK }}>
          <Inbox className="h-4 w-4" style={{ color: theme.accent }} aria-hidden="true" />
          {t("laptop.mail.inbox")}
        </h3>
        <span className="text-xs" style={{ color: MUTED }} data-testid="mail-unread-count">
          {t("laptop.mail.unreadCount", { count: unread })}
        </span>
        <div role="group" aria-label={t("laptop.mail.folderLabel")} className="ml-auto flex flex-wrap gap-1.5">
          {[MAIL_ALL, ...folders].map((name) => {
            const selected = activeFolder === name;
            return (
              <button
                key={name}
                type="button"
                aria-pressed={selected}
                data-testid={`mail-folder-${name}`}
                onClick={() => setFolder(name)}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium motion-safe:transition-colors ${FOCUS} ${
                  selected ? "border-[#2563eb] bg-[#2563eb] text-white" : "border-[#cdd9ec] bg-white text-[#14233d] hover:bg-[#eef3fb]"
                }`}
              >
                {folderName(name)}
              </button>
            );
          })}
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        {showList && renderList()}
        {showReader && renderReader()}
      </div>
    </div>
  );
};

const KNOWN_FOLDERS = ["university", "recruitment", "other"] as const;

function knownFolder(t: Tx, name: string): string {
  return (KNOWN_FOLDERS as readonly string[]).includes(name) ? t(`device.folders.${name}`) : name;
}
