"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";
import { getDatabase } from "@/lib/db/client";
import { profiles, relationship } from "@/lib/db/schema";

export async function saveSiteSettings(formData: FormData) {
  if (!isLiveMode()) throw new Error("演示模式不会保存设置。");
  await requireCoupleUser();
  const db = getDatabase();
  const title = String(formData.get("title") ?? "").trim();
  const togetherSince = String(formData.get("together_since") ?? "") || null;
  const firstMetOn = String(formData.get("first_met_on") ?? "") || null;
  if (!title) throw new Error("网站标题不能为空。");

  const profileRows = await db.select({ id: profiles.id }).from(profiles);
  for (const profile of profileRows) {
    const displayName = String(formData.get(`profile_${profile.id}`) ?? "").trim();
    if (displayName) {
      await db
        .update(profiles)
        .set({ displayName })
        .where(eq(profiles.id, profile.id));
    }
  }

  await db
    .insert(relationship)
    .values({
      id: 1,
      title,
      togetherSince,
      firstMetOn,
      partnerA: profileRows[0]?.id ?? null,
      partnerB: profileRows[1]?.id ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: relationship.id,
      set: {
        title,
        togetherSince,
        firstMetOn,
        partnerA: profileRows[0]?.id ?? null,
        partnerB: profileRows[1]?.id ?? null,
        updatedAt: new Date(),
      },
    });
  revalidatePath("/home");
  revalidatePath("/setup");
}
