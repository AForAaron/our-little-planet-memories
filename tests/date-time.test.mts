import assert from "node:assert/strict";
import test from "node:test";
import {
  appDateTimeInputToIso,
  formatDate,
  formatTimelineDateParts,
  parseAbsoluteDateTime,
  toAppDateTimeInput,
} from "../lib/utils.ts";

test("formats post timestamps in Asia/Shanghai regardless of server timezone", () => {
  assert.equal(
    formatDate("2026-07-20T16:30:00.000Z", true),
    "2026年7月21日 00:30",
  );
  assert.deepEqual(
    formatTimelineDateParts("2026-07-20T16:30:00.000Z"),
    { monthDay: "07.21", year: "2026" },
  );
});

test("round-trips datetime-local values as Asia/Shanghai instants", () => {
  assert.equal(
    appDateTimeInputToIso("2026-07-20T20:34"),
    "2026-07-20T12:34:00.000Z",
  );
  assert.equal(
    toAppDateTimeInput("2026-07-20T12:34:00.000Z"),
    "2026-07-20T20:34",
  );
});

test("rejects ambiguous timestamps without an explicit timezone", () => {
  assert.equal(parseAbsoluteDateTime("2026-07-20T20:34"), null);
  assert.equal(
    parseAbsoluteDateTime("2026-07-20T20:34:00+08:00")?.toISOString(),
    "2026-07-20T12:34:00.000Z",
  );
});
