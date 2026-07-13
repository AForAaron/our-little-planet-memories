"use client";

import { useEffect } from "react";

export function EntryAttentionMarker({ entryId }: { entryId: string }) {
  useEffect(() => {
    void fetch("/api/footprints/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId }),
    }).catch(() => undefined);
  }, [entryId]);

  return null;
}
