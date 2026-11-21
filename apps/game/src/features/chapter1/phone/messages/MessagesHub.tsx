// The Messages app: the conversation list, a conversation, and the phone's own messages (voicemail
// notes and call summaries that carry evidence). Opening a conversation reads it; the screen you
// leave stays as it was (the open conversation is held by the overlay).
import React from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EvidenceId } from "../../../../game/narrative/chapter1/ids";
import type { DeviceItemView } from "../../../../game/narrative/device";
import type { PhoneMessageView } from "../../../../game/narrative/selectors";
import type { DeviceAppProps } from "../../device/DeviceApp";
import { UI } from "../../theme";
import { MessagesApp } from "../MessagesApp";
import { ChatList } from "./ChatList";
import { ChatThread } from "./ChatThread";

export interface MessagesHubProps {
  /** The phone's own messages, without the voicemail and the call summaries. */
  storyMessages: readonly PhoneMessageView[];
  onInspectEvidence: (evidenceId: EvidenceId) => void;
  /** Leave the app (back to the home screen). */
  onBack: () => void;
  storyOpenId: string | null;
  onStoryOpen: (id: string | null) => void;
  /** The conversations of the Messages app. */
  chats: readonly DeviceItemView[];
  openChatId: string | null;
  onOpenChat: (id: string | null) => void;
  /** Opens a conversation for the first time: the core marks it read. */
  onOpenItem: (itemId: string) => void;
  onUseItem: (itemId: string, actionId: string) => void;
  onView?: DeviceAppProps["onView"];
}

export const MessagesHub: React.FC<MessagesHubProps> = ({
  storyMessages,
  onInspectEvidence,
  onBack,
  storyOpenId,
  onStoryOpen,
  chats,
  openChatId,
  onOpenChat,
  onOpenItem,
  onUseItem,
  onView,
}) => {
  const { t } = useTranslation("chapter1");
  const chat = openChatId === null ? null : (chats.find((item) => item.id === openChatId) ?? null);
  const storyOpen = storyOpenId !== null && storyMessages.some((message) => message.id === storyOpenId);

  if (chat !== null && !storyOpen) {
    return <ChatThread item={chat} onBack={() => onOpenChat(null)} onUseItem={onUseItem} />;
  }

  const openChat = (item: DeviceItemView) => {
    onOpenChat(item.id);
    if (!item.read) onOpenItem(item.id);
  };
  const showStory = storyMessages.length > 0 || chats.length === 0;
  return (
    <div className="space-y-4">
      {!storyOpen && (
        <button type="button" className={UI.buttonSecondary} onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("phone.messages.back")}
        </button>
      )}
      {showStory && (
        <MessagesApp messages={storyMessages} onInspectEvidence={onInspectEvidence} onBack={onBack} openId={storyOpenId} onOpen={onStoryOpen} showBack={false} />
      )}
      {!storyOpen && <ChatList chats={chats} onOpen={openChat} onView={onView} />}
    </div>
  );
};
