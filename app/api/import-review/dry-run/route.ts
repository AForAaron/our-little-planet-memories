import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { canUseReview } from "@/features/import-review/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

export async function GET(request: Request) {
  if (!canUseReview(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["--env-file-if-exists=.env.local", "scripts/import/publish.mjs", "--dry-run"],
      {
        cwd: process.cwd(),
        env: process.env,
        maxBuffer: 1024 * 1024 * 4,
        timeout: 1000 * 60 * 5,
      },
    );
    return NextResponse.json({
      ...JSON.parse(stdout),
      warningsOutput: stderr.trim(),
    });
  } catch (error) {
    const childError = error as Error & {
      stdout?: string;
      stderr?: string;
    };
    return NextResponse.json(
      {
        error: childError.message || "无法生成发布预览。",
        output: childError.stdout?.trim() ?? "",
        warnings: childError.stderr?.trim() ?? "",
      },
      { status: 500 },
    );
  }
}
