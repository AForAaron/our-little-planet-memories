"use client";

import { useRef } from "react";

const DEFAULT_EMOJIS = ["💕", "✨", "🌙", "🌸", "🥰", "📍", "🍽️", "🎬", "🌧️", "☀️", "🎂", "🐾"];

type EmojiTextFieldProps = {
  as?: "input" | "textarea";
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  className?: string;
  emojis?: string[];
  rows?: number;
};

export function EmojiTextField({
  as = "input",
  name,
  value,
  onChange,
  placeholder,
  maxLength,
  required,
  className = "",
  emojis = DEFAULT_EMOJIS,
  rows,
}: EmojiTextFieldProps) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  function insertEmoji(emoji: string) {
    const element = ref.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    if (maxLength && next.length > maxLength) return;
    onChange(next);
    requestAnimationFrame(() => {
      const cursor = start + emoji.length;
      ref.current?.focus();
      ref.current?.setSelectionRange(cursor, cursor);
    });
  }

  const fieldClassName = `field ${className}`.trim();
  return (
    <div className="grid gap-2">
      {as === "textarea" ? (
        <textarea
          ref={(node) => {
            ref.current = node;
          }}
          className={fieldClassName}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          rows={rows}
        />
      ) : (
        <input
          ref={(node) => {
            ref.current = node;
          }}
          className={fieldClassName}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
        />
      )}
      <div className="emoji-bar" aria-label="插入 emoji">
        {emojis.map((emoji) => (
          <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} aria-label={`插入 ${emoji}`}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
