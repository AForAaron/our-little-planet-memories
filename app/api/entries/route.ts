import { NextResponse } from "next/server";
import {
  createEntryFromForm,
  updateEntryFromForm,
  deleteEntryById,
} from "@/lib/data/entry-mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "操作失败。";
  const status =
    message.includes("登录") || message.includes("访客名单") ? 401 : 400;
  return NextResponse.json({ error: message }, { status });
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
    return NextResponse.json({ id });
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
