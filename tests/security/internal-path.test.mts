import assert from "node:assert/strict";
import test from "node:test";
import { normalizeInternalPath } from "../../lib/security/internal-path.ts";

test("normalizes relative application paths and drops fragments", () => {
  assert.equal(
    normalizeInternalPath(" /memories/first?source=map#photos "),
    "/memories/first?source=map",
  );
});

test("rejects protocol-relative, backslash, and absolute redirect targets", () => {
  for (const value of [
    "//attacker.example",
    "/\\attacker.example",
    "https://attacker.example",
    "/safe\nhttps://attacker.example",
  ]) {
    assert.equal(normalizeInternalPath(value), null);
  }
});

test("uses the supplied fallback for unsafe persisted paths", () => {
  assert.equal(normalizeInternalPath("//attacker.example", "/home"), "/home");
});
