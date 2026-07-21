import assert from "node:assert/strict";
import test from "node:test";
import {
  emailIsVerified,
  normalizeEmailAddress,
} from "../../lib/auth/verification.ts";

test("normalizes email addresses before allowlist checks", () => {
  assert.equal(normalizeEmailAddress("  Person@Example.COM  "), "person@example.com");
  assert.equal(normalizeEmailAddress(null), "");
});

test("requires an explicit verified flag", () => {
  assert.equal(emailIsVerified({ emailVerified: true }), true);
  assert.equal(emailIsVerified({ emailVerified: false }), false);
  assert.equal(emailIsVerified({ emailVerified: null }), false);
  assert.equal(emailIsVerified({}), false);
  assert.equal(emailIsVerified(null), false);
});
