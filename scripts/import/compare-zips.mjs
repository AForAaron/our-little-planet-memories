import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { DATA_ROOT, writeWorkJson } from "./shared.mjs";

const execFileAsync = promisify(execFile);

async function archiveEntries(file) {
  const { stdout } = await execFileAsync("/usr/bin/unzip", ["-v", file], {
    maxBuffer: 20 * 1024 * 1024,
  });
  const entries = new Map();
  for (const line of stdout.split("\n")) {
    const match = line.match(
      /^\s*(\d+)\s+\S+\s+\d+\s+\S+\s+\S+\s+\S+\s+([0-9a-fA-F]{8})\s{2}(.+)$/,
    );
    if (!match) continue;
    entries.set(match[3], {
      bytes: Number(match[1]),
      crc32: match[2].toLowerCase(),
    });
  }
  return entries;
}

async function main() {
  const archiveRoot = path.join(DATA_ROOT, "wechat", "archives");
  const names = (await readdir(archiveRoot))
    .filter((name) => name.toLowerCase().endsWith(".zip"))
    .sort();
  if (names.length !== 2) {
    throw new Error(`预期找到 2 份 ZIP，实际为 ${names.length}。`);
  }
  const [left, right] = await Promise.all(
    names.map((name) => archiveEntries(path.join(archiveRoot, name))),
  );
  const allNames = new Set([...left.keys(), ...right.keys()]);
  const onlyLeft = [];
  const onlyRight = [];
  const changed = [];
  for (const name of allNames) {
    const a = left.get(name);
    const b = right.get(name);
    if (!a) onlyRight.push(name);
    else if (!b) onlyLeft.push(name);
    else if (a.bytes !== b.bytes || a.crc32 !== b.crc32) {
      changed.push({ name, left: a, right: b });
    }
  }
  const report = {
    generatedAt: new Date().toISOString(),
    archives: names,
    entries: { left: left.size, right: right.size },
    identicalContents:
      onlyLeft.length === 0 && onlyRight.length === 0 && changed.length === 0,
    differences: { onlyLeft, onlyRight, changed },
    note: "比较文件路径、解压尺寸和 ZIP CRC-32；本报告不会删除任何归档。",
  };
  await writeWorkJson("zip-comparison.json", report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
