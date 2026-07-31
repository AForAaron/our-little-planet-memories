# Responsive QA checklist

Cross-device UI + canvas coord v2. Gold screenshots: companion overflow, decorate chrome, stroke misalignment.

## Batch A — chrome / companion / emoji

| Check | 375 | 768 | 1280 | Real phone |
|-------|-----|-----|------|------------|
| Header single row; phone = Logo + Add + More | | | | |
| Companion not clipped; reactions scroll | | | | |
| Emoji picker opens **above** input; insert works | | | | |
| Entry-form emoji still works | | | | |
| Companion POST not 403 | | | | |

## Batch B — layouts

| Check | 375 | 768 | 1280 |
|-------|-----|-----|------|
| Home days clamp; no horizontal scroll | | | |
| Timeline date column readable | | | |
| Map height usable with list | | | |
| Decorate: phone/tablet bottom sheet; desktop side toolbar | | | |
| Upload error copy (no R2-only wording) | | | |

## Batch C — canvas

| Case | Expect |
|------|--------|
| New stroke desktop → phone | Same relative place on anchor; does not wreck follow-ups |
| New sticker desktop → phone | Still by title/body |
| Old v1 strokes | Render; no crash; not worse than before |
| Invalid payload missing widthRatio on v2 | 400 from validation |
| Dual edit 409 | Still works |

## Ship gates (local 2026-07-31)

- [x] `npm run build` passed
- [x] `node --test tests/canvas-geometry.test.mts` passed (incl. v2)
- [x] `node --test tests/canvas-validation.test.mts` passed (incl. v2 widthRatio)
- [x] Diff excludes `request-origin*`, Auth, `.env*`; `next-env.d.ts` restored/not committed
- [ ] Deploy via `tcbr UpdateCloudRunServer` + single-line remark; verify new ImageUrl
- [ ] Post-deploy: phone companion emoji + write-path smoke on CloudBase URL

## Cloud guardrails

- Do not change Host same-origin policy (live=020 fix).
- COS CORS must allow CloudBase Run origin (console check).
- Signed URL TTL remains 3600s; refresh page if media 403 after long background.
