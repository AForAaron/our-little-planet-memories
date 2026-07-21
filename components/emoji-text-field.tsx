"use client";

import { Smile, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { EMOJI_GROUPS } from "@/lib/emoji/catalog";
import { useEmojiUsage } from "@/components/emoji-usage-provider";

type EmojiTextFieldProps = {
  as?: "input" | "textarea";
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  rows?: number;
  autoComplete?: string;
  autoFocus?: boolean;
  focusRequest?: number;
  scrollIntoViewOnFocus?: boolean;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  "aria-describedby"?: string;
};

type Selection = { start: number; end: number };

export function EmojiTextField({
  as = "input",
  id,
  name,
  value,
  onChange,
  placeholder,
  maxLength,
  required,
  disabled,
  className = "",
  rows,
  autoComplete,
  autoFocus = false,
  focusRequest,
  scrollIntoViewOnFocus = false,
  onKeyDown,
  "aria-describedby": ariaDescribedBy,
}: EmojiTextFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const selectionRef = useRef<Selection | null>(null);
  const hasFocused = useRef(false);
  const lastFocusRequest = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState("常用");
  const pickerId = useId();
  const { commonEmojis, recordEmoji } = useEmojiUsage();

  function rememberSelection() {
    const field = fieldRef.current;
    if (!field) return;
    selectionRef.current = {
      start: field.selectionStart ?? value.length,
      end: field.selectionEnd ?? value.length,
    };
  }

  function closePicker() {
    setOpen(false);
  }

  function openPicker() {
    rememberSelection();
    setActiveGroup("常用");
    setOpen(true);
  }

  function insertEmoji(emoji: string) {
    const selection = selectionRef.current ?? {
      start: fieldRef.current?.selectionStart ?? value.length,
      end: fieldRef.current?.selectionEnd ?? value.length,
    };
    const start = Math.min(selection.start, value.length);
    const end = Math.min(Math.max(selection.end, start), value.length);
    const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    if (maxLength && next.length > maxLength) return;

    onChange(next);
    recordEmoji(emoji);
    closePicker();
    requestAnimationFrame(() => {
      const cursor = start + emoji.length;
      fieldRef.current?.focus();
      fieldRef.current?.setSelectionRange(cursor, cursor);
      selectionRef.current = { start: cursor, end: cursor };
    });
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) closePicker();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePicker();
        fieldRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!autoFocus || disabled) return;
    if (focusRequest === undefined && hasFocused.current) return;
    if (focusRequest !== undefined && focusRequest === lastFocusRequest.current) return;

    hasFocused.current = true;
    lastFocusRequest.current = focusRequest;
    const frame = requestAnimationFrame(() => {
      const field = fieldRef.current;
      if (!field) return;
      if (scrollIntoViewOnFocus) {
        field.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
      field.focus({ preventScroll: true });
      const cursor = field.value.length;
      field.setSelectionRange(cursor, cursor);
      selectionRef.current = { start: cursor, end: cursor };
    });
    return () => cancelAnimationFrame(frame);
  }, [autoFocus, disabled, focusRequest, scrollIntoViewOnFocus]);

  const emojis = activeGroup === "常用"
    ? commonEmojis
    : EMOJI_GROUPS.find((group) => group.label === activeGroup)?.emojis ?? [];
  const fieldClassName = `field emoji-input ${as === "textarea" ? "emoji-textarea-input" : ""} ${className}`.trim();

  return (
    <div className="emoji-field" ref={rootRef}>
      {as === "textarea" ? (
        <textarea
          ref={(node) => {
            fieldRef.current = node;
          }}
          id={id}
          className={fieldClassName}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onSelect={rememberSelection}
          onKeyUp={rememberSelection}
          onFocus={rememberSelection}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          disabled={disabled}
          rows={rows}
          autoComplete={autoComplete}
          onKeyDown={onKeyDown}
          aria-describedby={ariaDescribedBy}
        />
      ) : (
        <input
          ref={(node) => {
            fieldRef.current = node;
          }}
          id={id}
          className={fieldClassName}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onSelect={rememberSelection}
          onKeyUp={rememberSelection}
          onFocus={rememberSelection}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          onKeyDown={onKeyDown}
          aria-describedby={ariaDescribedBy}
        />
      )}
      <button
        type="button"
        className="emoji-trigger"
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => (open ? closePicker() : openPicker())}
        disabled={disabled}
        aria-label="插入 Emoji"
        aria-expanded={open}
        aria-controls={open ? pickerId : undefined}
        title="插入 Emoji"
      >
        <Smile size={17} />
      </button>
      {open && (
        <div id={pickerId} className="emoji-picker" role="dialog" aria-label="选择 Emoji">
          <div className="emoji-picker-head">
            <b>选择 Emoji</b>
            <button type="button" onClick={closePicker} aria-label="关闭 Emoji 面板">
              <X size={16} />
            </button>
          </div>
          <div className="emoji-tabs" role="tablist" aria-label="Emoji 分类">
            <button
              type="button"
              role="tab"
              aria-selected={activeGroup === "常用"}
              className={activeGroup === "常用" ? "is-active" : ""}
              onClick={() => setActiveGroup("常用")}
            >
              常用
            </button>
            {EMOJI_GROUPS.map((group) => (
              <button
                key={group.label}
                type="button"
                role="tab"
                aria-selected={activeGroup === group.label}
                className={activeGroup === group.label ? "is-active" : ""}
                onClick={() => setActiveGroup(group.label)}
              >
                {group.label}
              </button>
            ))}
          </div>
          <div className="emoji-grid" role="tabpanel" aria-label={`${activeGroup} Emoji`}>
            {emojis.map((emoji) => (
              <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} aria-label={`插入 ${emoji}`}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
