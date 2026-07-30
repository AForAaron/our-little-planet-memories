import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { authIdentityMap } from "@/lib/db/schema";

export type AuthProviderName = "neon" | "cloudbase";

export async function findProfileIdByAuthIdentity(
  provider: AuthProviderName,
  providerUserId: string,
) {
  const [row] = await getDatabase()
    .select({ profileId: authIdentityMap.profileId })
    .from(authIdentityMap)
    .where(
      and(
        eq(authIdentityMap.provider, provider),
        eq(authIdentityMap.providerUserId, providerUserId),
      ),
    )
    .limit(1);
  return row?.profileId ?? null;
}

export async function upsertAuthIdentityMapping(input: {
  provider: AuthProviderName;
  providerUserId: string;
  profileId: string;
  email?: string | null;
}) {
  const db = getDatabase();
  const now = new Date();
  await db
    .insert(authIdentityMap)
    .values({
      provider: input.provider,
      providerUserId: input.providerUserId,
      profileId: input.profileId,
      email: input.email ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [authIdentityMap.provider, authIdentityMap.providerUserId],
      set: {
        profileId: input.profileId,
        email: input.email ?? null,
        updatedAt: now,
      },
    });
}
