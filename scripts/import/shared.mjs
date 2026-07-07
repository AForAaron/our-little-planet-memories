import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, "../..");

function requiredAbsoluteRoot(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `缺少环境变量 ${name}。导入工具不会回退到源码目录，请在 .env.local 中配置绝对路径。`,
    );
  }
  if (!path.isAbsolute(value)) {
    throw new Error(`${name} 必须是绝对路径：${value}`);
  }
  return path.resolve(value);
}

export const DATA_ROOT = requiredAbsoluteRoot("IMPORT_DATA_ROOT");
export const WORK_ROOT = requiredAbsoluteRoot("IMPORT_WORK_ROOT");
export const PUBLISH_ROOT = requiredAbsoluteRoot("IMPORT_PUBLISH_ROOT");
export const TIME_ZONE = "Asia/Shanghai";

export async function ensureWorkRoot() {
  await mkdir(WORK_ROOT, { recursive: true });
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export async function readWorkJson(name, fallback = null) {
  try {
    return await readJson(path.join(WORK_ROOT, name));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeWorkJson(name, value) {
  await ensureWorkRoot();
  const destination = path.join(WORK_ROOT, name);
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, destination);
}

export function stableHash(value, length = 16) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

export async function sha256File(file) {
  return await new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

export async function findWechatExport() {
  const candidates = [];
  const searchRoots = [
    DATA_ROOT,
    path.join(DATA_ROOT, "wechat", "exports"),
  ];
  for (const searchRoot of searchRoots) {
    if (!(await fileExists(searchRoot))) continue;
    for (const name of await readdir(searchRoot, { withFileTypes: true })) {
      if (!name.isDirectory()) continue;
      const directory = path.join(searchRoot, name.name);
      try {
        const manifest = await readJson(path.join(directory, "manifest.json"));
        candidates.push({ directory, manifest });
      } catch {
        // An incomplete extraction is ignored; the audit report will still expose it.
      }
    }
  }
  candidates.sort((a, b) =>
    String(b.manifest.exportedAt).localeCompare(String(a.manifest.exportedAt)),
  );
  if (!candidates[0]) {
    throw new Error("没有找到已解压且包含 manifest.json 的微信导出目录。");
  }
  return candidates[0];
}

export function relativeDataPath(file) {
  const relative = path.relative(DATA_ROOT, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`文件不在 Datas 内：${file}`);
  }
  return relative.split(path.sep).join("/");
}

export function resolveDataPath(relative) {
  const resolved = path.resolve(DATA_ROOT, relative);
  if (resolved !== DATA_ROOT && !resolved.startsWith(`${DATA_ROOT}${path.sep}`)) {
    throw new Error("非法数据路径。");
  }
  return resolved;
}

export async function fileExists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

export function localDay(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function localDateTime(iso) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function parseExifDate(value) {
  const match = String(value ?? "").match(
    /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/,
  );
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`).toISOString();
}

function createTiffReader(exif) {
  if (!exif || exif.toString("ascii", 0, 4) !== "Exif") return null;
  const tiff = 6;
  const littleEndian = exif.toString("ascii", tiff, tiff + 2) === "II";
  const uint16 = (offset) =>
    littleEndian ? exif.readUInt16LE(offset) : exif.readUInt16BE(offset);
  const uint32 = (offset) =>
    littleEndian ? exif.readUInt32LE(offset) : exif.readUInt32BE(offset);

  function entries(offset) {
    const start = tiff + offset;
    if (start < 0 || start + 2 > exif.length) return [];
    const count = uint16(start);
    const result = [];
    for (let index = 0; index < count; index += 1) {
      const cursor = start + 2 + index * 12;
      if (cursor + 12 > exif.length) break;
      result.push({
        tag: uint16(cursor),
        type: uint16(cursor + 2),
        count: uint32(cursor + 4),
        inline: cursor + 8,
        offset: uint32(cursor + 8),
      });
    }
    return result;
  }

  function ascii(entry) {
    if (!entry) return "";
    const start = entry.count <= 4 ? entry.inline : tiff + entry.offset;
    return exif
      .toString("ascii", start, Math.min(start + entry.count, exif.length))
      .replace(/\0/g, "");
  }

  function rationals(entry) {
    if (!entry) return [];
    const start = tiff + entry.offset;
    const values = [];
    for (let index = 0; index < entry.count; index += 1) {
      const cursor = start + index * 8;
      if (cursor + 8 > exif.length) break;
      const numerator = uint32(cursor);
      const denominator = uint32(cursor + 4);
      values.push(denominator ? numerator / denominator : 0);
    }
    return values;
  }

  return { tiff, uint32, entries, ascii, rationals };
}

export function parseExif(exif) {
  const reader = createTiffReader(exif);
  if (!reader) return { capturedAt: null, latitude: null, longitude: null };

  const root = reader.entries(reader.uint32(reader.tiff + 4));
  const getRoot = (tag) => root.find((entry) => entry.tag === tag);
  const exifPointer = getRoot(0x8769);
  const gpsPointer = getRoot(0x8825);

  let capturedAt = null;
  if (exifPointer) {
    const details = reader.entries(exifPointer.offset);
    const original = details.find((entry) => entry.tag === 0x9003);
    const digitized = details.find((entry) => entry.tag === 0x9004);
    capturedAt = parseExifDate(reader.ascii(original ?? digitized));
  }
  if (!capturedAt) capturedAt = parseExifDate(reader.ascii(getRoot(0x0132)));

  let latitude = null;
  let longitude = null;
  if (gpsPointer) {
    const gps = reader.entries(gpsPointer.offset);
    const getGps = (tag) => gps.find((entry) => entry.tag === tag);
    const latitudeParts = reader.rationals(getGps(2));
    const longitudeParts = reader.rationals(getGps(4));
    if (latitudeParts.length === 3 && longitudeParts.length === 3) {
      latitude =
        latitudeParts[0] + latitudeParts[1] / 60 + latitudeParts[2] / 3600;
      longitude =
        longitudeParts[0] + longitudeParts[1] / 60 + longitudeParts[2] / 3600;
      if (reader.ascii(getGps(1)) === "S") latitude *= -1;
      if (reader.ascii(getGps(3)) === "W") longitude *= -1;
    }
  }

  return { capturedAt, latitude, longitude };
}

export function haversineMeters(a, b) {
  if (
    a?.latitude == null ||
    a?.longitude == null ||
    b?.latitude == null ||
    b?.longitude == null
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const radius = 6_371_000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(b.latitude - a.latitude);
  const deltaLongitude = toRadians(b.longitude - a.longitude);
  const firstLatitude = toRadians(a.latitude);
  const secondLatitude = toRadians(b.latitude);
  const value =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(deltaLongitude / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function roundCoordinate(value, privacyLevel) {
  if (value == null) return null;
  if (privacyLevel === "exact") return Number(value.toFixed(6));
  if (privacyLevel === "private") return Number(value.toFixed(2));
  return Number(value.toFixed(3));
}

export function precisionMeters(privacyLevel) {
  if (privacyLevel === "exact") return 5;
  if (privacyLevel === "private") return 1_000;
  return 100;
}

export function chineseBigrams(value) {
  const normalized = String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{Script=Han}a-z0-9]+/gu, "");
  const result = new Set();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    result.add(normalized.slice(index, index + 2));
  }
  return result;
}

export function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

export function hammingDistance(left, right) {
  if (!left || !right || left.length !== right.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const xor = Number.parseInt(left[index], 16) ^ Number.parseInt(right[index], 16);
    distance += xor.toString(2).replaceAll("0", "").length;
  }
  return distance;
}

export async function loadSharp() {
  try {
    const module = await import("sharp");
    return module.default;
  } catch {
    const pnpm = path.join(ROOT, "node_modules", ".pnpm");
    const name = (await readdir(pnpm)).find((entry) => entry.startsWith("sharp@"));
    if (!name) throw new Error("缺少 sharp。请先安装项目依赖。");
    const module = await import(
      path.join(pnpm, name, "node_modules", "sharp", "lib", "index.js")
    );
    return module.default;
  }
}

export async function averageHash(sharp, file) {
  const { data } = await sharp(file)
    .rotate()
    .resize(8, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const average = data.reduce((total, value) => total + value, 0) / data.length;
  let bits = "";
  for (const value of data) bits += value >= average ? "1" : "0";
  let hex = "";
  for (let index = 0; index < bits.length; index += 4) {
    hex += Number.parseInt(bits.slice(index, index + 4), 2).toString(16);
  }
  return hex;
}

export function isBlockedAttachment(relative) {
  return /\.(?:exe|msi|bat|cmd|com|scr|ps1)$/i.test(relative);
}
