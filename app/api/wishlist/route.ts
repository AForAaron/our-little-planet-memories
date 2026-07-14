import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";
import { getDatabase } from "@/lib/db/client";
import { wishlistItems } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function assertLive() {
  if (!isLiveMode()) throw new Error("演示模式不会保存愿望。");
}

async function requireUserJson() {
  const user = await getCoupleUser();
  if (!user) throw new Error("登录已失效，请重新登录。");
  return user;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "操作失败。";
  const status = message.includes("登录")
    ? 401
    : message.includes("没有找到")
      ? 404
      : 400;
  return NextResponse.json(
    { error: message },
    { status },
  );
}

export async function POST(request: Request) {
  try {
    assertLive();
    const user = await requireUserJson();
    const formData = await request.formData();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    if (!title) throw new Error("愿望标题不能为空。");
    const [wish] = await getDatabase()
      .insert(wishlistItems)
      .values({
        title,
        description: description || null,
        createdBy: user.id,
      })
      .returning({
        id: wishlistItems.id,
        title: wishlistItems.title,
        description: wishlistItems.description,
        isDone: wishlistItems.isDone,
      });
    revalidatePath("/daily/wishlist");
    return NextResponse.json({ item: wish });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertLive();
    await requireUserJson();
    const body = (await request.json()) as { id?: string; done?: boolean };
    if (!body.id) throw new Error("缺少愿望 ID。");
    const done = Boolean(body.done);
    const [updated] = await getDatabase()
      .update(wishlistItems)
      .set({ isDone: done, doneAt: done ? new Date() : null })
      .where(eq(wishlistItems.id, body.id))
      .returning({
        id: wishlistItems.id,
        title: wishlistItems.title,
        description: wishlistItems.description,
        isDone: wishlistItems.isDone,
      });
    if (!updated) throw new Error("没有找到这个愿望。");
    revalidatePath("/daily/wishlist");
    return NextResponse.json({ item: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertLive();
    await requireUserJson();
    const body = (await request.json()) as { id?: string };
    if (!body.id) throw new Error("缺少愿望 ID。");
    const [deleted] = await getDatabase()
      .delete(wishlistItems)
      .where(eq(wishlistItems.id, body.id))
      .returning({ id: wishlistItems.id });
    if (!deleted) throw new Error("没有找到这个愿望。");
    revalidatePath("/daily/wishlist");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
