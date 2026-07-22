import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  CANVAS_STICKERS,
  CANVAS_STICKER_SHEETS,
  getCanvasStickerDefinition,
  getCanvasStickerLabel,
} from "../lib/canvas/stickers.ts";

test("keeps sticker keys unique and every sprite inside its declared sheet", () => {
  assert.equal(CANVAS_STICKERS.length, 36);
  assert.equal(
    new Set(CANVAS_STICKERS.map((sticker) => sticker.assetKey)).size,
    CANVAS_STICKERS.length,
  );

  for (const sticker of CANVAS_STICKERS) {
    const sheet = CANVAS_STICKER_SHEETS[sticker.sheetKey];
    assert.ok(sticker.column >= 0 && sticker.column < sheet.columns);
    assert.ok(sticker.row >= 0 && sticker.row < sheet.rows);
  }
});

test("exposes the new dog sticker through the shared catalog", () => {
  const dog = getCanvasStickerDefinition("dog");
  assert.deepEqual(dog, {
    assetKey: "dog",
    label: "小狗",
    sheetKey: "cuteAnimals",
    column: 0,
    row: 0,
  });
  assert.equal(getCanvasStickerLabel("dog"), "小狗");
  assert.equal(getCanvasStickerLabel("missing"), "可爱图案");
});

test("generated cute sticker sheet has twelve isolated transparent cells", async () => {
  const imageUrl = new URL(
    "../public/stickers/cute-animals-v1.png",
    import.meta.url,
  );
  const { data, info } = await sharp(fileURLToPath(imageUrl))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  assert.equal(info.width, 1536);
  assert.equal(info.height, 512);
  assert.equal(info.channels, 4);

  for (let tileIndex = 0; tileIndex < 12; tileIndex += 1) {
    const tileLeft = (tileIndex % 6) * 256;
    const tileTop = Math.floor(tileIndex / 6) * 256;
    let opaquePixels = 0;

    for (let y = 0; y < 256; y += 1) {
      for (let x = 0; x < 256; x += 1) {
        const alpha = data[
          ((tileTop + y) * info.width + tileLeft + x) * info.channels + 3
        ];
        if (alpha > 16) opaquePixels += 1;
        if (x < 12 || x >= 244 || y < 12 || y >= 244) {
          assert.equal(alpha, 0, `贴纸单元 ${tileIndex + 1} 越过安全边界`);
        }
      }
    }

    assert.ok(opaquePixels > 4_000, `贴纸单元 ${tileIndex + 1} 内容为空`);
  }
});
