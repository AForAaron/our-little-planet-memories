"use client";

import { MessageSquarePlus, Send } from "lucide-react";
import { useMemo } from "react";
import type { KeyboardEvent } from "react";
import { EmojiTextField } from "@/components/emoji-text-field";
import { EmojiUsageProvider } from "@/components/emoji-usage-provider";

type FollowUpComposerProps = {
  id?: string;
  isDemo?: boolean;
  mode: "create" | "reply";
  pending: boolean;
  value: string;
  error: string;
  focusRequest?: number;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export default function FollowUpComposer({
  id,
  isDemo = false,
  mode,
  pending,
  value,
  error,
  focusRequest,
  onCancel,
  onChange,
  onSubmit,
}: FollowUpComposerProps) {
  const remaining = useMemo(() => 500 - value.length, [value]);
  const trimmedValue = value.trim();
  const isReply = mode === "reply";

  function submitWithShortcut(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (
      event.key !== "Enter"
      || (!event.metaKey && !event.ctrlKey)
      || event.nativeEvent.isComposing
      || pending
      || !trimmedValue
    ) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <EmojiUsageProvider isDemo={isDemo}>
      <form
        className={isReply ? "follow-up-reply-form" : "follow-up-form"}
        onSubmit={onSubmit}
      >
        <label className="sr-only" htmlFor={id}>
          {isReply ? "回复这条追评" : "追加追评"}
        </label>
        <EmojiTextField
          as="textarea"
          id={id}
          className="field follow-up-textarea"
          value={value}
          onChange={(next) => onChange(next.slice(0, 500))}
          placeholder={isReply ? "回复这条追评..." : "比如：现在回头看，那天最想记住的是..."}
          maxLength={500}
          autoFocus
          focusRequest={focusRequest}
          scrollIntoViewOnFocus={isReply}
          onKeyDown={submitWithShortcut}
        />
        <div className="follow-up-actions">
          {!isReply && <span className={remaining < 40 ? "is-low" : ""}>{remaining}</span>}
          <div className={isReply ? "flex items-center gap-2" : undefined}>
            <button className="button-secondary" type="button" onClick={onCancel} disabled={pending}>
              取消
            </button>
            <button className="button-primary" type="submit" disabled={pending || !trimmedValue}>
              {pending ? <MessageSquarePlus className="animate-spin" size={16} /> : <Send size={16} />}
              {isReply ? "回复" : "追加"}
            </button>
          </div>
        </div>
        {error && <p className="follow-up-error" aria-live="polite">{error}</p>}
      </form>
    </EmojiUsageProvider>
  );
}
