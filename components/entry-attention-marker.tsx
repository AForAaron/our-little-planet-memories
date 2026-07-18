"use client";

import { useEffect } from "react";
import { readApiJson } from "@/lib/http/read-api-json";

export function EntryAttentionMarker({ entryId }: { entryId: string }) {
  useEffect(() => {
    void fetch("/api/footprints/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId }),
    })
      .then((response) =>
        readApiJson<{ ok?: boolean }>(response, "标记回忆通知失败。"))
      .catch(() => undefined);
  }, [entryId]);

  return null;
}
