import { NextResponse } from "next/server";
import { getCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";
import {
  createEntryFromForm,
  updateEntryFromForm,
  deleteEntryById,
} from "@/lib/data/entry-mutations";
import {
  DEFAULT_ENTRY_PAGE_SIZE,
  getEntryListItem,
  getEntriesPage,
} from "@/lib/data/memories";
import {
  ENTRY_CATEGORIES,
  type EntryCategory,
} from "@/lib/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "操作失败。";
  const status =
    message.includes("登录") || message.includes("访客名单") ? 401 : 400;
  return NextResponse.json({ error: message }, { status });
}

function readCategories(value: string | null): EntryCategory[] {
  if (!value) return [];
  const categories = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const invalid = categories.find(
    (category) => !ENTRY_CATEGORIES.includes(category as EntryCategory),
  );
  if (invalid) throw new Error(`不支持的回忆分类：${invalid}`);
  return Array.from(new Set(categories)) as EntryCategory[];
}

function readLimit(value: string | null) {
  if (value == null || value === "") return DEFAULT_ENTRY_PAGE_SIZE;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("limit 必须是大于 0 的整数。");
  }
  return parsed;
}

export async function GET(request: Request) {
  try {
    if (isLiveMode()) {
      const user = await getCoupleUser();
      if (!user) throw new Error("登录已失效，请重新登录。");
    }
    const url = new URL(request.url);
    const page = await getEntriesPage({
      categories: readCategories(url.searchParams.get("categories")),
      cursor: url.searchParams.get("cursor"),
      limit: readLimit(url.searchParams.get("limit")),
    });
    return NextResponse.json(
      {
        items: page.items,
        nextCursor: page.nextCursor,
        total: page.total,
      },
      {
        // The response includes short-lived private R2 URLs; do not allow a
        // shared intermediary to retain them.
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const id = await createEntryFromForm(await request.formData());
    return NextResponse.json({ id });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const id = await updateEntryFromForm(await request.formData());
    const item = await getEntryListItem(id);
    if (!item) throw new Error("回忆已保存，但无法读取更新后的卡片数据。请刷新后重试。");
    return NextResponse.json({ id, item });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) throw new Error("缺少要删除的回忆 ID。");
    await deleteEntryById(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
