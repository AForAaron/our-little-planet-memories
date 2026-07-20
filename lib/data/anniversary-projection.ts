import "server-only";

import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import { requireCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";
import { DEMO_ENTRIES } from "@/lib/data/demo";
import { getDatabase } from "@/lib/db/client";
import { entries } from "@/lib/db/schema";

/**
 * The anniversary banner needs only enough data to find the next calendar
 * occurrence. Keep it independent from the paginated timeline reader so a
 * large archive never turns this small calculation into a media/signing read.
 */
export type AnniversaryProjection = {
  id: string;
  title: string | null;
  happened_at: string;
};

export const getAnniversaryProjection = cache(
  async (): Promise<AnniversaryProjection[]> => {
    if (!isLiveMode()) {
      return DEMO_ENTRIES.filter((entry) => entry.category === "anniversary")
        .map(({ id, title, happened_at }) => ({ id, title, happened_at }))
        .sort(
          (left, right) =>
            new Date(left.happened_at).getTime() -
              new Date(right.happened_at).getTime() ||
            left.id.localeCompare(right.id),
        );
    }

    await requireCoupleUser();

    const rows = await getDatabase()
      .select({
        id: entries.id,
        title: entries.title,
        happenedAt: entries.happenedAt,
      })
      .from(entries)
      .where(eq(entries.category, "anniversary"))
      .orderBy(asc(entries.happenedAt), asc(entries.id));

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      happened_at: row.happenedAt.toISOString(),
    }));
  },
);
