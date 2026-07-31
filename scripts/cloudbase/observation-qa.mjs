#!/usr/bin/env node
/**
 * Observation-period write-gate + transport probes against CloudBase Run.
 * Mimics browser Origin / Sec-Fetch-Site / session cookie (no secrets printed).
 *
 * Usage (from repo root, proxy OFF for tencent):
 *   node --env-file=.env.cloudbase.auth.local scripts/cloudbase/observation-qa.mjs
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE =
  process.env.OBSERVATION_BASE_URL?.trim() ||
  "https://little-planet-web-289461-10-1349689007.sh.run.tcloudbase.com";
const ORIGIN = new URL(BASE).origin;
const COOKIE_NAME = "planet_cloudbase_session";
const MARK = `obs-qa-${new Date().toISOString().slice(0, 10)}`;

function maskEmail(email) {
  return String(email).replace(/^(.).+(@.+)$/, "$1***$2");
}

function authBase() {
  const envId = process.env.CLOUDBASE_ENV_ID?.trim();
  if (!envId) throw new Error("CLOUDBASE_ENV_ID required");
  return `https://${envId}.api.tcloudbasegateway.com/auth`;
}

function deviceId() {
  return process.env.CLOUDBASE_AUTH_DEVICE_ID?.trim() || "observation-qa";
}

async function signIn(email, password) {
  const res = await fetch(`${authBase()}/v1/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-device-id": deviceId(),
    },
    body: JSON.stringify({ username: email, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    return { ok: false, status: res.status, error: data.code || data.error };
  }
  return { ok: true, token: data.access_token, sub: data.sub };
}

function browserHeaders(token, extra = {}) {
  return {
    Origin: ORIGIN,
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    Cookie: `${COOKIE_NAME}=${token}`,
    ...extra,
  };
}

async function api(token, path, init = {}) {
  const headers = new Headers(browserHeaders(token, init.headers));
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${BASE}${path}`, {
    method: init.method || "GET",
    headers,
    body:
      init.json !== undefined
        ? JSON.stringify(init.json)
        : init.body !== undefined
          ? init.body
          : undefined,
    redirect: "manual",
  });
  const contentType = res.headers.get("content-type") || "";
  let body = null;
  if (contentType.includes("application/json")) {
    body = await res.json().catch(() => null);
  } else {
    body = await res.text().catch(() => "");
  }
  return { status: res.status, body, headers: res.headers };
}

function record(results, id, pass, detail) {
  results.push({ id, pass, detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`${mark} ${id}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
}

function isOriginBlock(res) {
  return (
    res.status === 403 &&
    res.body &&
    typeof res.body === "object" &&
    String(res.body.error || "").includes("请求必须从本站页面发起")
  );
}

async function createEntry(token, title) {
  const form = new FormData();
  form.set("title", title);
  form.set("body", `${MARK} automated observation write-gate`);
  form.set("happened_at", new Date().toISOString());
  form.set("category", "moment");
  form.set("uploaded_media", "[]");
  return api(token, "/api/entries", { method: "POST", body: form });
}

async function patchEntry(token, id, title) {
  const form = new FormData();
  form.set("id", id);
  form.set("title", title);
  form.set("body", `${MARK} patched`);
  form.set("happened_at", new Date().toISOString());
  form.set("category", "moment");
  form.set("uploaded_media", "[]");
  return api(token, "/api/entries", { method: "PATCH", body: form });
}

async function runForUser(tag, email, password, results, shared) {
  const signed = await signIn(email, password);
  if (!signed.ok) {
    record(results, `${tag}.signin`, false, signed);
    return null;
  }
  record(results, `${tag}.signin`, true, { email: maskEmail(email), sub: signed.sub });

  const home = await api(signed.token, "/home");
  record(results, `${tag}.home`, home.status === 200, { status: home.status });

  const entriesGet = await api(signed.token, "/api/entries?limit=5");
  record(results, `${tag}.entries.get`, entriesGet.status === 200, {
    status: entriesGet.status,
    count: entriesGet.body?.items?.length,
  });

  return { tag, token: signed.token, email: maskEmail(email), shared };
}

async function writeGate(userA, userB, results) {
  // W1 A create entry
  const w1 = await createEntry(userA.token, `${MARK} A entry`);
  const w1Ok = w1.status === 200 && Boolean(w1.body?.id) && !isOriginBlock(w1);
  record(results, "W1.A.entries.post", w1Ok, {
    status: w1.status,
    id: w1.body?.id,
    originBlock: isOriginBlock(w1),
    error: w1.body?.error,
  });
  if (!w1Ok) return;
  const entryA = w1.body.id;

  // W2 follow-up
  const w2 = await api(userA.token, `/api/entries/${entryA}/follow-ups`, {
    method: "POST",
    json: { body: `${MARK} follow-up from A` },
  });
  const w2Ok = w2.status === 200 && Boolean(w2.body?.item?.id) && !isOriginBlock(w2);
  record(results, "W2.A.follow-ups.post", w2Ok, {
    status: w2.status,
    id: w2.body?.item?.id,
    originBlock: isOriginBlock(w2),
    error: w2.body?.error,
  });
  if (!w2Ok) return;
  const followUpId = w2.body.item.id;

  // W3 reply
  const w3 = await api(userA.token, `/api/entries/${entryA}/follow-ups`, {
    method: "POST",
    json: { parentId: followUpId, body: `${MARK} reply from A` },
  });
  const w3Ok =
    w3.status === 200 &&
    Boolean(w3.body?.item?.id) &&
    w3.body.item.parent_id === followUpId &&
    !isOriginBlock(w3);
  record(results, "W3.A.follow-ups.reply", w3Ok, {
    status: w3.status,
    id: w3.body?.item?.id,
    parent_id: w3.body?.item?.parent_id,
    originBlock: isOriginBlock(w3),
    error: w3.body?.error,
  });

  // W4 B create entry + follow-up
  const w4e = await createEntry(userB.token, `${MARK} B entry`);
  const w4eOk = w4e.status === 200 && Boolean(w4e.body?.id) && !isOriginBlock(w4e);
  record(results, "W4.B.entries.post", w4eOk, {
    status: w4e.status,
    id: w4e.body?.id,
    originBlock: isOriginBlock(w4e),
    error: w4e.body?.error,
  });
  let entryB = w4e.body?.id;
  if (w4eOk) {
    const w4f = await api(userB.token, `/api/entries/${entryB}/follow-ups`, {
      method: "POST",
      json: { body: `${MARK} follow-up from B` },
    });
    record(results, "W4.B.follow-ups.post", w4f.status === 200 && Boolean(w4f.body?.item?.id), {
      status: w4f.status,
      id: w4f.body?.item?.id,
      originBlock: isOriginBlock(w4f),
      error: w4f.body?.error,
    });
  }

  // W5 patch A entry
  const w5 = await patchEntry(userA.token, entryA, `${MARK} A entry edited`);
  record(results, "W5.A.entries.patch", w5.status === 200 && Boolean(w5.body?.item), {
    status: w5.status,
    title: w5.body?.item?.title,
    originBlock: isOriginBlock(w5),
    error: w5.body?.error,
  });

  // W6 wishlist
  const wishForm = new FormData();
  wishForm.set("title", `${MARK} wish`);
  wishForm.set("description", "observation qa");
  const w6 = await api(userA.token, "/api/wishlist", { method: "POST", body: wishForm });
  record(results, "W6.A.wishlist.post", w6.status === 200 && Boolean(w6.body?.item?.id), {
    status: w6.status,
    id: w6.body?.item?.id,
    originBlock: isOriginBlock(w6),
    error: w6.body?.error,
  });

  // W7 canvas sticker
  const stickerId = randomUUID();
  const w7 = await api(userA.token, `/api/entries/${entryA}/canvas-items`, {
    method: "POST",
    json: {
      id: stickerId,
      kind: "sticker",
      anchor_key: "stage",
      x_ratio: 0.4,
      y_ratio: 0.4,
      width_ratio: 0.15,
      rotation: 0,
      opacity: 1,
      z_index: 1,
      payload: { assetKey: "heart" },
    },
  });
  record(
    results,
    "W7.A.canvas.post",
    (w7.status === 200 || w7.status === 201) && Boolean(w7.body?.item?.id),
    {
      status: w7.status,
      id: w7.body?.item?.id,
      originBlock: isOriginBlock(w7),
      error: w7.body?.error,
    },
  );

  // W8 companion
  const w8 = await api(userA.token, "/api/companion/messages", {
    method: "POST",
    json: {
      body: `${MARK} companion whisper`,
      pagePath: "/home",
      pageTitle: "Home",
    },
  });
  record(results, "W8.A.companion.post", w8.status === 200 && Boolean(w8.body?.message?.id), {
    status: w8.status,
    id: w8.body?.message?.id,
    originBlock: isOriginBlock(w8),
    error: w8.body?.error,
  });

  // Extra mutating endpoints
  const presence = await api(userA.token, "/api/presence", {
    method: "POST",
    json: { currentPath: "/home", pageTitle: "Home" },
  });
  record(results, "X.presence.post", presence.status === 200, {
    status: presence.status,
    originBlock: isOriginBlock(presence),
    error: presence.body?.error,
  });

  const emoji = await api(userA.token, "/api/emoji-usage", {
    method: "POST",
    json: { emoji: "⭐" },
  });
  record(results, "X.emoji-usage.post", emoji.status === 200 || emoji.status === 201, {
    status: emoji.status,
    originBlock: isOriginBlock(emoji),
    error: emoji.body?.error,
  });

  // Cross-origin must be rejected
  const cross = await fetch(`${BASE}/api/wishlist`, {
    method: "POST",
    headers: {
      Origin: "https://evil.example",
      "Sec-Fetch-Site": "cross-site",
      Cookie: `${COOKIE_NAME}=${userA.token}`,
    },
    body: (() => {
      const f = new FormData();
      f.set("title", "should-fail");
      return f;
    })(),
  });
  const crossBody = await cross.json().catch(() => ({}));
  record(results, "X.cross-origin.rejected", cross.status === 403, {
    status: cross.status,
    error: crossBody.error,
  });

  // Missing Origin rejected
  const noOrigin = await fetch(`${BASE}/api/presence`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${COOKIE_NAME}=${userA.token}`,
    },
    body: JSON.stringify({ currentPath: "/home" }),
  });
  const noOriginBody = await noOrigin.json().catch(() => ({}));
  record(results, "X.missing-origin.rejected", noOrigin.status === 403, {
    status: noOrigin.status,
    error: noOriginBody.error,
  });

  return { entryA, entryB, followUpId, wishId: w6.body?.item?.id, stickerId };
}

async function mediaAndReads(userA, entryId, results) {
  // Presign tiny png
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const presign = await api(userA.token, "/api/uploads/presign", {
    method: "POST",
    json: {
      fileName: "obs-qa.png",
      mime: "image/png",
      size: png.byteLength,
      variant: "original",
    },
  });
  record(results, "M1.presign", presign.status === 200 && Boolean(presign.body?.uploadUrl), {
    status: presign.status,
    hasUrl: Boolean(presign.body?.uploadUrl),
    r2Key: Boolean(presign.body?.r2Key),
    originBlock: isOriginBlock(presign),
    error: presign.body?.error,
  });

  if (presign.status === 200 && presign.body?.uploadUrl && presign.body?.r2Key) {
    const put = await fetch(presign.body.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "image/png",
      },
      body: png,
    });
    record(results, "M2.cos.put", put.status >= 200 && put.status < 300, {
      status: put.status,
    });

    if (put.status >= 200 && put.status < 300) {
      const form = new FormData();
      form.set("title", `${MARK} media entry`);
      form.set("body", "with png");
      form.set("happened_at", new Date().toISOString());
      form.set("category", "moment");
      form.set(
        "uploaded_media",
        JSON.stringify([
          {
            r2Key: presign.body.r2Key,
            mime: "image/png",
            size: png.byteLength,
            type: "image",
            originalName: "obs-qa.png",
          },
        ]),
      );
      const save = await api(userA.token, "/api/entries", { method: "POST", body: form });
      record(results, "M3.entries.post.withMedia", save.status === 200 && Boolean(save.body?.id), {
        status: save.status,
        id: save.body?.id,
        originBlock: isOriginBlock(save),
        error: save.body?.error,
      });
      if (save.body?.id) {
        const detail = await api(userA.token, `/memories/${save.body.id}`);
        record(results, "M4.memory.page", detail.status === 200, { status: detail.status });
        const list = await api(userA.token, `/api/entries?limit=5`);
        const item = list.body?.items?.find((row) => row.id === save.body.id);
        const mediaUrl =
          item?.media?.[0]?.display_url ||
          item?.media?.[0]?.thumbnail_url ||
          null;
        if (mediaUrl) {
          const mediaGet = await fetch(mediaUrl);
          record(results, "M5.signed.media.get", mediaGet.status === 200, {
            status: mediaGet.status,
          });
          const unauth = await fetch(mediaUrl.split("?")[0]);
          record(results, "M6.unsigned.media.denied", unauth.status === 403 || unauth.status === 400, {
            status: unauth.status,
          });
        } else {
          record(results, "M5.signed.media.get", false, {
            reason: "no media url on list item",
            keys: item ? Object.keys(item) : null,
            media0: item?.media?.[0] ? Object.keys(item.media[0]) : null,
          });
        }
      }
    }
  }

  // Route display pages
  for (const path of [
    "/home",
    "/time/timeline",
    "/footprints",
    "/places/map",
    "/daily/wishlist",
    "/notifications",
    entryId ? `/memories/${entryId}` : null,
  ].filter(Boolean)) {
    const page = await api(userA.token, path);
    record(results, `P.page${path}`, page.status === 200, { status: page.status });
  }

  // Read APIs
  for (const path of [
    "/api/notifications",
    "/api/presence",
    "/api/footprints?limit=5",
    "/api/companion/messages?limit=5",
    "/api/map-points?bbox=30.5,120.5,32.0,122.0",
    "/api/geocode/search?q=上海",
  ]) {
    const res = await api(userA.token, path);
    record(results, `R${path.split("?")[0]}`, res.status === 200, {
      status: res.status,
      error: res.body?.error,
    });
  }

  // Unauth
  const unauthEntries = await fetch(`${BASE}/api/entries`);
  record(results, "S.unauth.entries", unauthEntries.status === 401, {
    status: unauthEntries.status,
  });
}

async function collabChecks(userA, userB, entryA, results) {
  // B reads A's follow-ups
  const list = await api(userB.token, `/api/entries/${entryA}/follow-ups`);
  record(results, "C1.B.sees.A.follow-ups", list.status === 200 && (list.body?.items?.length ?? 0) > 0, {
    status: list.status,
    count: list.body?.items?.length,
  });

  // B posts follow-up on A's entry
  const bComment = await api(userB.token, `/api/entries/${entryA}/follow-ups`, {
    method: "POST",
    json: { body: `${MARK} B comments on A` },
  });
  record(results, "C2.B.follow-up.on.A", bComment.status === 200 && Boolean(bComment.body?.item?.id), {
    status: bComment.status,
    originBlock: isOriginBlock(bComment),
    error: bComment.body?.error,
  });

  // Canvas items visible to B
  const canvas = await api(userB.token, `/api/entries/${entryA}/canvas-items`);
  record(results, "C3.B.sees.canvas", canvas.status === 200 && (canvas.body?.items?.length ?? 0) > 0, {
    status: canvas.status,
    count: canvas.body?.items?.length,
  });

  // Presence from B while A posts presence
  await api(userA.token, "/api/presence", {
    method: "POST",
    json: { currentPath: `/memories/${entryA}`, pageTitle: "Memory" },
  });
  const presence = await api(userB.token, "/api/presence");
  record(results, "C4.presence.summary", presence.status === 200, {
    status: presence.status,
    keys: presence.body && typeof presence.body === "object" ? Object.keys(presence.body) : null,
  });

  // Companion messages readable by B
  const msgs = await api(userB.token, "/api/companion/messages?limit=10");
  const hasObs = Array.isArray(msgs.body?.messages)
    && msgs.body.messages.some((m) => String(m.body || "").includes(MARK));
  record(results, "C5.B.sees.companion", msgs.status === 200 && hasObs, {
    status: msgs.status,
    hasObs,
  });
}

async function main() {
  const results = [];
  console.log(JSON.stringify({ base: BASE, origin: ORIGIN, mark: MARK }, null, 2));

  const health = await fetch(`${BASE}/api/health?db=1&auth=1&sharp=1`);
  const healthBody = await health.json().catch(() => ({}));
  // Unauthenticated auth probe may report hasUser:false → overall ok:false / 503.
  // Gate on db+sharp which prove live wiring.
  const healthOk = healthBody?.db?.ok === true && healthBody?.sharp?.ok === true;
  record(results, "0.health.db_sharp", healthOk, {
    http: health.status,
    mode: healthBody.mode,
    db: healthBody.db,
    sharp: healthBody.sharp,
    auth: healthBody.auth,
  });

  const userA = await runForUser(
    "A",
    process.env.CLOUDBASE_TEST_EMAIL_1,
    process.env.CLOUDBASE_TEST_PASSWORD_1,
    results,
  );
  const userB = await runForUser(
    "B",
    process.env.CLOUDBASE_TEST_EMAIL_2,
    process.env.CLOUDBASE_TEST_PASSWORD_2,
    results,
  );
  if (!userA || !userB) {
    writeReport(results, null);
    process.exit(1);
  }

  const created = await writeGate(userA, userB, results);
  if (created?.entryA) {
    await mediaAndReads(userA, created.entryA, results);
    await collabChecks(userA, userB, created.entryA, results);
  }

  const summary = writeReport(results, created);
  if (!summary.ok) process.exit(1);
}

function writeReport(results, created) {
  const failed = results.filter((r) => !r.pass);
  const summary = {
    ok: failed.length === 0,
    base: BASE,
    mark: MARK,
    at: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: failed.map((r) => r.id),
    created,
    results,
  };
  const outPath = resolve("docs/plans/OBSERVATION_QA_RESULTS.json");
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\nSummary: ${summary.passed}/${summary.total} passed; wrote ${outPath}`);
  if (failed.length) {
    console.log("Failed:", failed.map((r) => r.id).join(", "));
  }
  return summary;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
