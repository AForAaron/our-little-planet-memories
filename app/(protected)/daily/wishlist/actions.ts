"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";
import { getDatabase } from "@/lib/db/client";
import { wishlistItems } from "@/lib/db/schema";

function writable() {
  if (!isLiveMode()) throw new Error("演示模式不会保存愿望。");
}

export async function createWish(formData: FormData) {
  writable();
  const user = await requireCoupleUser();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!title) throw new Error("愿望标题不能为空。");
  await getDatabase().insert(wishlistItems).values({
    title,
    description: description || null,
    createdBy: user.id,
  });
  revalidatePath("/daily/wishlist");
}

export async function toggleWish(id: string, done: boolean) {
  writable();
  await requireCoupleUser();
  await getDatabase()
    .update(wishlistItems)
    .set({ isDone: done, doneAt: done ? new Date() : null })
    .where(eq(wishlistItems.id, id));
  revalidatePath("/daily/wishlist");
}

export async function deleteWish(id: string) {
  writable();
  await requireCoupleUser();
  await getDatabase().delete(wishlistItems).where(eq(wishlistItems.id, id));
  revalidatePath("/daily/wishlist");
}
