import { randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { canUseReview } from "@/features/import-review/server/store";
import { getImportRoots } from "@/features/import-review/server/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONFIRMATION = "正式发布";
const execFileAsync = promisify(execFile);

type PublishRequest = {
  confirmation?: string;
  expected?: {
    events?: number;
    media?: number;
    messages?: number;
  };
};

function progressFile() {
  return path.join(getImportRoots().publishRoot, "publication-progress.json");
}

async function readProgress() {
  try {
    return JSON.parse(await readFile(progressFile(), "utf8")) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: "idle", logs: [] };
    }
    throw error;
  }
}

async function publishIsLocked() {
  try {
    await stat(path.join(getImportRoots().publishRoot, "publication.lock"));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function writeInitialProgress(summary: Record<string, unknown>) {
  const value = {
    id: randomUUID(),
    status: "starting",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    phase: "启动发布任务",
    current: 0,
    total: Number(summary.events ?? 0),
    summary,
    error: null,
    logs: [
      {
        at: new Date().toISOString(),
        message: "已启动后台发布任务",
      },
    ],
  };
  await writeFile(progressFile(), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return value;
}

async function publishDryRunSummary() {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--env-file-if-exists=.env.local", "scripts/import/publish.mjs", "--dry-run"],
    {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 1024 * 1024 * 4,
      timeout: 1000 * 60 * 5,
    },
  );
  return JSON.parse(stdout) as Record<string, unknown>;
}

export async function GET(request: Request) {
  if (!canUseReview(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(await readProgress());
}

export async function POST(request: Request) {
  if (!canUseReview(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as PublishRequest;
  if (body.confirmation !== CONFIRMATION) {
    return NextResponse.json(
      { error: `请输入“${CONFIRMATION}”后再继续。` },
      { status: 400 },
    );
  }

  const summary = await publishDryRunSummary();
  if (!Number(summary.events)) {
    return NextResponse.json(
      { error: "没有新的已批准事件需要发布。", summary },
      { status: 400 },
    );
  }
  if (
    body.expected?.events !== summary.events ||
    body.expected?.media !== summary.media ||
    body.expected?.messages !== summary.messages
  ) {
    return NextResponse.json(
      { error: "发布预览已变化，请重新预览后再发布。", summary },
      { status: 409 },
    );
  }
  if (await publishIsLocked()) {
    return NextResponse.json(
      { error: "已有发布任务正在运行，请等待当前任务结束。", progress: await readProgress() },
      { status: 409 },
    );
  }

  const progress = await writeInitialProgress(summary as Record<string, unknown>);
  const child = spawn(
    process.execPath,
    ["--env-file-if-exists=.env.local", "scripts/import/publish.mjs", "--apply"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PUBLISH_CONFIRMED: "YES",
        PUBLISH_PROGRESS_FILE: progressFile(),
      },
      stdio: "ignore",
      detached: false,
    },
  );
  child.unref();
  return NextResponse.json({
    started: true,
    pid: child.pid,
    progress,
  });
}
