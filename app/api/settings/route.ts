import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";
import { getDatabase } from "@/lib/db/client";
import { profiles, relationship } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isLiveMode()) {
      return NextResponse.json(
        { error: "演示模式不会保存设置。" },
        { status: 400 },
      );
    }
    const user = await getCoupleUser();
    if (!user) {
      return NextResponse.json(
        { error: "登录已失效，请重新登录后再保存。" },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const db = getDatabase();
    const title = String(formData.get("title") ?? "").trim();
    const togetherSince = String(formData.get("together_since") ?? "") || null;
    const firstMetOn = String(formData.get("first_met_on") ?? "") || null;
    if (!title) {
      return NextResponse.json(
        { error: "网站标题不能为空。" },
        { status: 400 },
      );
    }

    const profileRows = await db
      .select({ id: profiles.id })
      .from(profiles)
      .orderBy(asc(profiles.createdAt));
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
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存失败。" },
      { status: 500 },
    );
  }
}
