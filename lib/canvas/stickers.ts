export const CANVAS_STICKER_SHEETS = {
  classic: {
    src: "/stickers/planet-sticker-sheet.png",
    columns: 6,
    rows: 4,
  },
  cuteAnimals: {
    src: "/stickers/cute-animals-v1.png",
    columns: 6,
    rows: 2,
  },
} as const;

export type CanvasStickerSheetKey = keyof typeof CANVAS_STICKER_SHEETS;

export type CanvasStickerDefinition = {
  assetKey: string;
  label: string;
  sheetKey: CanvasStickerSheetKey;
  column: number;
  row: number;
};

export const CANVAS_STICKERS = [
  { assetKey: "donut-planet", label: "甜甜圈星球", sheetKey: "classic", column: 0, row: 0 },
  { assetKey: "sparkle", label: "闪闪星光", sheetKey: "classic", column: 1, row: 0 },
  { assetKey: "heart", label: "爱心", sheetKey: "classic", column: 2, row: 0 },
  { assetKey: "moon", label: "月亮", sheetKey: "classic", column: 3, row: 0 },
  { assetKey: "cloud", label: "云朵", sheetKey: "classic", column: 4, row: 0 },
  { assetKey: "strawberry", label: "草莓", sheetKey: "classic", column: 5, row: 0 },
  { assetKey: "cat", label: "小猫", sheetKey: "classic", column: 0, row: 1 },
  { assetKey: "bunny", label: "小兔", sheetKey: "classic", column: 1, row: 1 },
  { assetKey: "bear", label: "小熊", sheetKey: "classic", column: 2, row: 1 },
  { assetKey: "cherries", label: "樱桃", sheetKey: "classic", column: 3, row: 1 },
  { assetKey: "flower", label: "小花", sheetKey: "classic", column: 4, row: 1 },
  { assetKey: "rainbow", label: "彩虹", sheetKey: "classic", column: 5, row: 1 },
  { assetKey: "tape-coral", label: "珊瑚胶带", sheetKey: "classic", column: 0, row: 2 },
  { assetKey: "tape-amber", label: "琥珀胶带", sheetKey: "classic", column: 1, row: 2 },
  { assetKey: "tape-cyan", label: "蓝色胶带", sheetKey: "classic", column: 2, row: 2 },
  { assetKey: "arrow-curved", label: "弯箭头", sheetKey: "classic", column: 3, row: 2 },
  { assetKey: "arrow-straight", label: "直箭头", sheetKey: "classic", column: 4, row: 2 },
  { assetKey: "scribble", label: "手绘线圈", sheetKey: "classic", column: 5, row: 2 },
  { assetKey: "love-letter", label: "情书", sheetKey: "classic", column: 0, row: 3 },
  { assetKey: "camera", label: "相机", sheetKey: "classic", column: 1, row: 3 },
  { assetKey: "cup", label: "小杯子", sheetKey: "classic", column: 2, row: 3 },
  { assetKey: "house", label: "小屋", sheetKey: "classic", column: 3, row: 3 },
  { assetKey: "footprints", label: "脚印", sheetKey: "classic", column: 4, row: 3 },
  { assetKey: "shooting-star", label: "流星", sheetKey: "classic", column: 5, row: 3 },
  { assetKey: "dog", label: "小狗", sheetKey: "cuteAnimals", column: 0, row: 0 },
  { assetKey: "corgi", label: "小柯基", sheetKey: "cuteAnimals", column: 1, row: 0 },
  { assetKey: "hamster", label: "小仓鼠", sheetKey: "cuteAnimals", column: 2, row: 0 },
  { assetKey: "penguin", label: "小企鹅", sheetKey: "cuteAnimals", column: 3, row: 0 },
  { assetKey: "duckling", label: "小鸭", sheetKey: "cuteAnimals", column: 4, row: 0 },
  { assetKey: "frog", label: "小青蛙", sheetKey: "cuteAnimals", column: 5, row: 0 },
  { assetKey: "paw-heart", label: "爱心爪印", sheetKey: "cuteAnimals", column: 0, row: 1 },
  { assetKey: "bow", label: "蝴蝶结", sheetKey: "cuteAnimals", column: 1, row: 1 },
  { assetKey: "mushroom", label: "小蘑菇", sheetKey: "cuteAnimals", column: 2, row: 1 },
  { assetKey: "cupcake", label: "纸杯蛋糕", sheetKey: "cuteAnimals", column: 3, row: 1 },
  { assetKey: "butterfly", label: "小蝴蝶", sheetKey: "cuteAnimals", column: 4, row: 1 },
  { assetKey: "crown", label: "小皇冠", sheetKey: "cuteAnimals", column: 5, row: 1 },
] as const satisfies readonly CanvasStickerDefinition[];

export type CanvasStickerAssetKey = (typeof CANVAS_STICKERS)[number]["assetKey"];

export const CANVAS_STICKER_ASSET_KEYS = CANVAS_STICKERS.map(
  (sticker) => sticker.assetKey,
) as CanvasStickerAssetKey[];

const CANVAS_STICKER_BY_KEY = new Map<string, CanvasStickerDefinition>(
  CANVAS_STICKERS.map((sticker) => [sticker.assetKey, sticker]),
);

export function getCanvasStickerDefinition(assetKey: string) {
  return CANVAS_STICKER_BY_KEY.get(assetKey) ?? null;
}

export function getCanvasStickerLabel(assetKey: string) {
  return getCanvasStickerDefinition(assetKey)?.label ?? "可爱图案";
}
