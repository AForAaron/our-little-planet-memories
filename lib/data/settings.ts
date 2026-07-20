import "server-only";

import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import { requireCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";
import { DEMO_RELATIONSHIP } from "@/lib/data/demo";
import { getDatabase } from "@/lib/db/client";
import { profiles, relationship } from "@/lib/db/schema";

export const getSiteSettings = cache(async function getSiteSettings() {
  if (!isLiveMode()) {
    return {
      relationship: DEMO_RELATIONSHIP,
      profiles: [
        { id: "demo-a", displayName: "我", theme: "light" },
        { id: "demo-b", displayName: "你", theme: "dark" },
      ],
      isDemo: true,
    };
  }

  await requireCoupleUser();

  const db = getDatabase();
  const [relationshipRows, profileRows] = await Promise.all([
    db.select().from(relationship).where(eq(relationship.id, 1)).limit(1),
    db
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        theme: profiles.theme,
      })
      .from(profiles)
      .orderBy(asc(profiles.createdAt)),
  ]);
  const item = relationshipRows[0];
  return {
    relationship: item
      ? {
          id: item.id,
          title: item.title,
          together_since: item.togetherSince,
          first_met_on: item.firstMetOn,
          partner_a: item.partnerA,
          partner_b: item.partnerB,
          updated_at: item.updatedAt.toISOString(),
        }
      : {
          ...DEMO_RELATIONSHIP,
          title: "我们的小星球",
          together_since: null,
        },
    profiles: profileRows,
    isDemo: false,
  };
});
