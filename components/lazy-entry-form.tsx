"use client";

import type { ComponentProps } from "react";
import { EmojiUsageProvider } from "./emoji-usage-provider";
import { EntryForm, type EntrySavePayload } from "./entry-form";

export type EntrySavedPayload = EntrySavePayload;

type EntryFormProps = ComponentProps<typeof EntryForm>;

export type LazyEntryFormProps = EntryFormProps & {
  isDemo: boolean;
};

export function LazyEntryForm({ isDemo, ...formProps }: LazyEntryFormProps) {
  return (
    <EmojiUsageProvider isDemo={isDemo}>
      <EntryForm {...formProps} />
    </EmojiUsageProvider>
  );
}
