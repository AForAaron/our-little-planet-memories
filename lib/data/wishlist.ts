import "server-only";

import { asc } from "drizzle-orm";
import { requireCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";
import { getDatabase } from "@/lib/db/client";
import { wishlistItems } from "@/lib/db/schema";

export async function getWishlist() {
  if (!isLiveMode()) {
    return {
      items: [
        { id: "demo-wish-1", title: "一起看一次极光", description: "在很冷的地方喝热巧克力。", isDone: false },
        { id: "demo-wish-2", title: "做一顿完整的晚餐", description: null, isDone: true },
      ],
      isDemo: true,
    };
  }
  await requireCoupleUser();
  const rows = await getDatabase()
    .select()
    .from(wishlistItems)
    .orderBy(asc(wishlistItems.sortOrder), asc(wishlistItems.createdAt));
  return {
    items: rows.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      isDone: item.isDone,
    })),
    isDemo: false,
  };
}
