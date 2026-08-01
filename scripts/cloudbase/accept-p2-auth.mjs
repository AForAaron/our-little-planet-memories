#!/usr/bin/env node
/**
 * P2 Auth acceptance (no secrets printed).
 * Requires .env.cloudbase.auth.local (+ optional DATABASE_URL for map checks).
 */
import pg from "pg";

function maskEmail(email) {
  return String(email).replace(/^(.).+(@.+)$/, "$1***$2");
}

function authBase() {
  return `https://${process.env.CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com/auth`;
}

async function signIn(email, password) {
  const res = await fetch(`${authBase()}/v1/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-device-id": "p2-accept",
    },
    body: JSON.stringify({ username: email, password }),
  });
  const data = await res.json();
  return { ok: res.ok && Boolean(data.access_token), status: res.status, data };
}

async function userMe(token) {
  const res = await fetch(`${authBase()}/v1/user/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-device-id": "p2-accept",
    },
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

async function main() {
  const cases = [
    ["u1", process.env.CLOUDBASE_TEST_EMAIL_1, process.env.CLOUDBASE_TEST_PASSWORD_1],
    ["u2", process.env.CLOUDBASE_TEST_EMAIL_2, process.env.CLOUDBASE_TEST_PASSWORD_2],
  ];
  const results = [];

  for (const [tag, email, password] of cases) {
    if (!email || !password) throw new Error(`missing creds for ${tag}`);
    const signed = await signIn(email, password);
    if (!signed.ok) {
      results.push({ tag, email: maskEmail(email), signIn: false, error: signed.data.code });
      continue;
    }
    const me = await userMe(signed.data.access_token);
    const other = cases.find(([t]) => t !== tag);
    const cross = await signIn(email, other[2]);
    // cross-password must fail
    const rejectNonAllow = await signIn("not-on-list@example.com", "WrongPass123!");
    results.push({
      tag,
      email: maskEmail(email),
      signIn: true,
      uid: signed.data.sub,
      meOk: me.ok,
      meEmail: me.data.email ? maskEmail(me.data.email) : null,
      status: me.data.status,
      crossPasswordRejected: !cross.ok,
      nonAllowlistRejected: !rejectNonAllow.ok,
    });
  }

  let mapOk = null;
  if (process.env.DATABASE_URL) {
    const ssl =
      process.env.PGSSL === "disable"
        ? false
        : { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== "false" };
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl });
    await client.connect();
    const { rows } = await client.query(
      `select provider_user_id, profile_id::text, email from auth_identity_map where provider='cloudbase'`,
    );
    await client.end();
    const uids = new Set(results.map((r) => r.uid).filter(Boolean));
    mapOk =
      rows.length >= 2 &&
      [...uids].every((uid) => rows.some((r) => r.provider_user_id === uid));
    results.push({
      identityMapRows: rows.length,
      identityMapCoversBoth: mapOk,
    });
  }

  const allOk =
    results.filter((r) => r.tag).every(
      (r) =>
        r.signIn &&
        r.meOk &&
        r.crossPasswordRejected &&
        r.nonAllowlistRejected,
    ) && mapOk !== false;

  console.log(JSON.stringify({ ok: allOk, results }, null, 2));
  if (!allOk) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
