import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { canUseReview, dryRunSummary } from "@/features/import-review/server/store";
import { getImportRoots } from "@/features/import-review/server/paths";
import type { ReviewCandidate } from "@/features/import-review/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const CONFIRMATION = "正式发布";

type PublishRequest = {
  confirmation?: string;
  expected?: {
    events?: number;
    media?: number;
    messages?: number;
  };
};

async function commandExists(command: string) {
  try {
    await execFileAsync("/usr/bin/which", [command]);
    return true;
  } catch {
    return false;
  }
}

async function selectedApprovedWavCount() {
  const candidatesFile = path.join(getImportRoots().workRoot, "candidates.json");
  const candidates = JSON.parse(await readFile(candidatesFile, "utf8")) as ReviewCandidate[];
  return candidates
    .filter((candidate) => candidate.status === "approved")
    .flatMap((candidate) => candidate.selectedMediaPaths)
    .filter((sourcePath) => /\.wav$/i.test(sourcePath)).length;
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

  const summary = await dryRunSummary();
  if (!Number(summary.events)) {
    return NextResponse.json(
      { error: "没有已批准事件，拒绝空发布。", summary },
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
  const wavCount = await selectedApprovedWavCount();
  if (wavCount > 0 && !(await commandExists("ffmpeg"))) {
    return NextResponse.json(
      {
        error: `已批准内容中有 ${wavCount} 个 WAV 语音，但本机没有 ffmpeg。请先安装 ffmpeg，或在审核台取消选择这些 WAV 语音后再发布。`,
        summary,
      },
      { status: 400 },
    );
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["--env-file-if-exists=.env.local", "scripts/import/publish.mjs", "--apply"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PUBLISH_CONFIRMED: "YES",
        },
        maxBuffer: 1024 * 1024 * 12,
        timeout: 1000 * 60 * 30,
      },
    );
    return NextResponse.json({
      summary,
      output: stdout.trim(),
      warnings: stderr.trim(),
    });
  } catch (error) {
    const childError = error as Error & {
      stdout?: string;
      stderr?: string;
    };
    return NextResponse.json(
      {
        error: childError.message || "正式发布失败。",
        output: childError.stdout?.trim() ?? "",
        warnings: childError.stderr?.trim() ?? "",
        summary,
      },
      { status: 500 },
    );
  }
}
