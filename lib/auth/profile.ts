import "server-only";

import { eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";

type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

export async function ensureProfile(user: AuthUser) {
  const db = getDatabase();
  const [existing] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  if (existing) return;

  await db
    .insert(profiles)
    .values({
      id: user.id,
      displayName: user.name?.trim() || user.email.split("@")[0],
      avatarUrl: user.image ?? null,
      theme: "warm",
    })
    .onConflictDoNothing();
}
