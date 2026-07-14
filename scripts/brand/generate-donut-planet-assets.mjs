import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourcePath = join(root, "docs/design/assets/donut-planet-source.png");
const whiteHeroSourcePath = join(root, "docs/design/assets/donut-planet-white-hero-source.png");
const brandDir = join(root, "public/brand");
const appDir = join(root, "app");
const canvasColor = [253, 249, 240];
const padding = 48;

async function createTransparentMaster() {
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.from(data);

  for (let index = 0; index < data.length; index += info.channels) {
    const [red, green, blue] = data.subarray(index, index + 3);
    const distance = Math.hypot(red - canvasColor[0], green - canvasColor[1], blue - canvasColor[2]);
    // The original art was anti-aliased against the warm canvas. A hard matte
    // prevents that canvas color from becoming a pale halo on dark surfaces.
    const alpha = distance > 14 ? 255 : 0;

    output[index + 3] = alpha;
    if (alpha === 0) {
      output[index] = 0;
      output[index + 1] = 0;
      output[index + 2] = 0;
    }
  }

  return sharp(output, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 0 })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function createWhiteHero() {
  const { data, info } = await sharp(whiteHeroSourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.alloc(data.length);

  for (let index = 0; index < data.length; index += info.channels) {
    const whiteChannel = Math.min(data[index], data[index + 1], data[index + 2]);
    // The supplied artwork uses near-white pixels exclusively for its logo.
    const alpha = whiteChannel >= 235 ? 255 : 0;

    output[index] = 255;
    output[index + 1] = 255;
    output[index + 2] = 255;
    output[index + 3] = alpha;
  }

  return sharp(output, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 0 })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function renderSquare(master, size) {
  return sharp(master)
    .resize({
      width: size,
      height: size,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function createIco(master) {
  const sizes = [16, 32, 48];
  const images = await Promise.all(sizes.map((size) => renderSquare(master, size)));
  const directorySize = 6 + (16 * images.length);
  const output = Buffer.alloc(directorySize + images.reduce((total, image) => total + image.length, 0));

  output.writeUInt16LE(0, 0);
  output.writeUInt16LE(1, 2);
  output.writeUInt16LE(images.length, 4);

  let offset = directorySize;
  images.forEach((image, index) => {
    const size = sizes[index];
    const entry = 6 + (index * 16);

    output.writeUInt8(size, entry);
    output.writeUInt8(size, entry + 1);
    output.writeUInt8(0, entry + 2);
    output.writeUInt8(0, entry + 3);
    output.writeUInt16LE(1, entry + 4);
    output.writeUInt16LE(32, entry + 6);
    output.writeUInt32LE(image.length, entry + 8);
    output.writeUInt32LE(offset, entry + 12);
    image.copy(output, offset);
    offset += image.length;
  });

  return output;
}

await Promise.all([mkdir(brandDir, { recursive: true }), mkdir(appDir, { recursive: true })]);

const master = await createTransparentMaster();
const whiteHero = await createWhiteHero();
const icon512 = await renderSquare(master, 512);
const icon192 = await renderSquare(master, 192);
const appleIcon = await renderSquare(master, 180);
const favicon = await createIco(master);

await Promise.all([
  writeFile(join(brandDir, "donut-planet.png"), master),
  writeFile(join(brandDir, "donut-planet-white-hero.png"), whiteHero),
  writeFile(join(brandDir, "donut-planet-512.png"), icon512),
  writeFile(join(brandDir, "donut-planet-192.png"), icon192),
  writeFile(join(appDir, "icon.png"), icon512),
  writeFile(join(appDir, "apple-icon.png"), appleIcon),
  writeFile(join(appDir, "favicon.ico"), favicon),
]);

const metadata = await sharp(master).metadata();
console.log(`Generated transparent donut planet assets (${metadata.width}x${metadata.height}).`);
