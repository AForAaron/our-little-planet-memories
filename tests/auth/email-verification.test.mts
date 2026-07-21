import assert from "node:assert/strict";
import test from "node:test";
import {
  emailIsVerified,
  normalizeEmailAddress,
  normalizeEmailVerificationCode,
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

test("accepts exactly six numeric verification characters", () => {
  assert.equal(normalizeEmailVerificationCode(" 123456 "), "123456");
  assert.equal(normalizeEmailVerificationCode("12345"), "");
  assert.equal(normalizeEmailVerificationCode("1234567"), "");
  assert.equal(normalizeEmailVerificationCode("12a456"), "");
  assert.equal(normalizeEmailVerificationCode(null), "");
});
