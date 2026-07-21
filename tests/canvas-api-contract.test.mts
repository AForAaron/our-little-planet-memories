import assert from "node:assert/strict";
import test from "node:test";
import {
  EntryCanvasError,
  getEntryCanvasConflictItem,
  getEntryCanvasErrorMessage,
  getEntryCanvasErrorStatus,
} from "../lib/canvas/errors.ts";
import type { EntryCanvasItem } from "../lib/database.types.ts";
import { isTrustedSameOriginRequest } from "../lib/security/request-origin-policy.ts";

const latestItem: EntryCanvasItem = {
  id: "9cfa84a2-665f-4bb0-9484-395a96209e11",
  entry_id: "6bb7c52b-5ead-4b73-8197-b39c88c476e1",
  author_id: "2dd691fe-5748-47dc-9444-ad2aef319e30",
  kind: "sticker",
  anchor_key: "body",
  x_ratio: 0.2,
  y_ratio: 0.3,
  width_ratio: 0.15,
  rotation: 0,
  opacity: 1,
  z_index: 1,
  payload: { assetKey: "cat" },
  revision: 3,
  created_at: "2026-07-21T00:00:00.000Z",
  updated_at: "2026-07-21T00:00:00.000Z",
};

test("maps an optimistic conflict to 409 with the latest item", () => {
  const error = new EntryCanvasError("版本冲突", 409, latestItem);
  assert.equal(getEntryCanvasErrorStatus(error), 409);
  assert.equal(getEntryCanvasErrorMessage(error), "版本冲突");
  assert.equal(getEntryCanvasConflictItem(error), latestItem);
});

test("keeps validation errors public but hides unexpected server details", () => {
  const validationError = new Error("坐标越界");
  validationError.name = "CanvasValidationError";
  assert.equal(getEntryCanvasErrorStatus(validationError), 400);
  assert.equal(getEntryCanvasErrorMessage(validationError), "坐标越界");

  const databaseError = new Error("password authentication failed for user secret");
  assert.equal(getEntryCanvasErrorStatus(databaseError), 500);
  assert.equal(
    getEntryCanvasErrorMessage(databaseError),
    "画板服务暂时不可用，请稍后再试。",
  );
  assert.equal(getEntryCanvasConflictItem(databaseError), undefined);
});

test("accepts same-origin writes and rejects missing or cross-site origins", () => {
  const requestUrl = "https://planet.example/api/entries/abc/canvas-items";
  assert.equal(isTrustedSameOriginRequest({
    requestUrl,
    origin: "https://planet.example",
    fetchSite: "same-origin",
  }), true);
  assert.equal(isTrustedSameOriginRequest({
    requestUrl,
    origin: "https://evil.example",
    fetchSite: "cross-site",
  }), false);
  assert.equal(isTrustedSameOriginRequest({
    requestUrl,
    origin: null,
    fetchSite: null,
  }), false);
});
