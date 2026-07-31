#!/usr/bin/env node
/**
 * Observation-period full live probe (agent-owned).
 * Mimics browser Origin / Sec-Fetch-Site / session cookie (no secrets printed).
 *
 * Usage:
 *   node --env-file=.env.cloudbase.auth.local scripts/cloudbase/observation-qa.mjs
 *   node --env-file=.env.cloudbase.auth.local scripts/cloudbase/observation-qa.mjs --cleanup-only
 */
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE =
  process.env.OBSERVATION_BASE_URL?.trim() ||
  "https://little-planet-web-289461-10-1349689007.sh.run.tcloudbase.com";
const ORIGIN = new URL(BASE).origin;
const COOKIE_NAME = "planet_cloudbase_session";
const MARK = `obs-qa-${new Date().toISOString().slice(0, 10)}`;
const CLEANUP_ONLY = process.argv.includes("--cleanup-only");

const MOJIBAKE_MARKERS = ["\uFFFD", "Ã¤", "Ã¥", "â€", "çš„"];
const PAGE_EXPECTATIONS = [
  { path: "/home", needles: ["在一起", "回忆"] },
  { path: "/time/timeline", needles: ["回忆"] },
  { path: "/daily/wishlist", needles: ["愿望"] },
  { path: "/footprints", needles: ["足迹"] },
  { path: "/places/map", needles: ["地图", "地点", "足迹"] },
  { path: "/notifications", needles: ["通知"] },
];

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
  const headers = new Headers(browserHeaders(token, init.headers || {}));
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
  return { status: res.status, body, headers: res.headers, contentType };
}

function record(results, id, pass, detail) {
  results.push({ id, pass: Boolean(pass), detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(
    `${mark} ${id}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`,
  );
}

function skip(results, id, reason) {
  results.push({ id, pass: true, detail: { skipped: true, reason } });
  console.log(`SKIP ${id}: ${reason}`);
}

function isOriginBlock(res) {
  return (
    res.status === 403 &&
    res.body &&
    typeof res.body === "object" &&
    String(res.body.error || "").includes("请求必须从本站页面发起")
  );
}

function isObsItem(item) {
  const title = String(item?.title || "");
  const body = String(item?.body || "");
  return (
    title.includes("obs-qa-") ||
    body.includes("obs-qa-") ||
    body.includes("automated observation write-gate")
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

async function deleteEntry(token, id) {
  return api(token, "/api/entries", {
    method: "DELETE",
    json: { id },
  });
}

async function listAllEntries(token) {
  let cursor = null;
  const items = [];
  for (let page = 0; page < 30; page++) {
    const url = new URL("/api/entries", BASE);
    url.searchParams.set("limit", "50");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, {
      headers: browserHeaders(token),
    });
    const data = await res.json();
    items.push(...(data.items || []));
    cursor = data.nextCursor;
    if (!cursor) break;
  }
  return items;
}

async function cleanupObsData(tokens, results) {
  const seen = new Set();
  let deleted = 0;
  for (const token of tokens) {
    for (const item of await listAllEntries(token)) {
      if (!isObsItem(item) || seen.has(item.id)) continue;
      seen.add(item.id);
      let ok = false;
      for (const t of tokens) {
        const r = await deleteEntry(t, item.id);
        if (r.status === 200) {
          ok = true;
          deleted += 1;
          break;
        }
      }
      if (!ok) {
        record(results, `cleanup.entry.${item.id}`, false, {
          title: item.title,
        });
      }
    }
  }

  // Wishlist: create then delete is covered in matrix; leftover wishes with MARK title
  // are deleted in writeGate. Best-effort: nothing listable via GET.

  if (results) {
    record(results, "Z.cleanup.obsEntries", true, { deleted, scanned: seen.size });
  }
  return deleted;
}

async function runForUser(tag, email, password, results) {
  const signed = await signIn(email, password);
  if (!signed.ok) {
    record(results, `${tag}.signin`, false, signed);
    return null;
  }
  record(results, `${tag}.signin`, true, {
    email: maskEmail(email),
    sub: signed.sub,
  });

  const home = await api(signed.token, "/home");
  record(results, `${tag}.home`, home.status === 200, { status: home.status });

  const entriesGet = await api(signed.token, "/api/entries?limit=5");
  record(results, `${tag}.entries.get`, entriesGet.status === 200, {
    status: entriesGet.status,
    count: entriesGet.body?.items?.length,
  });

  return { tag, token: signed.token, email: maskEmail(email) };
}

async function writeGate(userA, userB, results) {
  const w1 = await createEntry(userA.token, `${MARK} A entry`);
  const w1Ok = w1.status === 200 && Boolean(w1.body?.id) && !isOriginBlock(w1);
  record(results, "W1.A.entries.post", w1Ok, {
    status: w1.status,
    id: w1.body?.id,
    originBlock: isOriginBlock(w1),
    error: w1.body?.error,
  });
  if (!w1Ok) return null;
  const entryA = w1.body.id;

  const w2 = await api(userA.token, `/api/entries/${entryA}/follow-ups`, {
    method: "POST",
    json: { body: `${MARK} follow-up from A` },
  });
  const w2Ok =
    w2.status === 200 && Boolean(w2.body?.item?.id) && !isOriginBlock(w2);
  record(results, "W2.A.follow-ups.post", w2Ok, {
    status: w2.status,
    id: w2.body?.item?.id,
    originBlock: isOriginBlock(w2),
    error: w2.body?.error,
  });
  if (!w2Ok) return { entryA };
  const followUpId = w2.body.item.id;

  const w3 = await api(userA.token, `/api/entries/${entryA}/follow-ups`, {
    method: "POST",
    json: { parentId: followUpId, body: `${MARK} reply from A` },
  });
  record(
    results,
    "W3.A.follow-ups.reply",
    w3.status === 200 &&
      Boolean(w3.body?.item?.id) &&
      w3.body.item.parent_id === followUpId &&
      !isOriginBlock(w3),
    {
      status: w3.status,
      id: w3.body?.item?.id,
      parent_id: w3.body?.item?.parent_id,
      originBlock: isOriginBlock(w3),
      error: w3.body?.error,
    },
  );

  const w4e = await createEntry(userB.token, `${MARK} B entry`);
  const w4eOk =
    w4e.status === 200 && Boolean(w4e.body?.id) && !isOriginBlock(w4e);
  record(results, "W4.B.entries.post", w4eOk, {
    status: w4e.status,
    id: w4e.body?.id,
    originBlock: isOriginBlock(w4e),
    error: w4e.body?.error,
  });
  const entryB = w4e.body?.id;
  if (w4eOk) {
    const w4f = await api(userB.token, `/api/entries/${entryB}/follow-ups`, {
      method: "POST",
      json: { body: `${MARK} follow-up from B` },
    });
    record(
      results,
      "W4.B.follow-ups.post",
      w4f.status === 200 && Boolean(w4f.body?.item?.id),
      {
        status: w4f.status,
        id: w4f.body?.item?.id,
        originBlock: isOriginBlock(w4f),
        error: w4f.body?.error,
      },
    );
  }

  const w5 = await patchEntry(userA.token, entryA, `${MARK} A entry edited`);
  record(
    results,
    "W5.A.entries.patch",
    w5.status === 200 && Boolean(w5.body?.item),
    {
      status: w5.status,
      title: w5.body?.item?.title,
      originBlock: isOriginBlock(w5),
      error: w5.body?.error,
    },
  );

  const wishForm = new FormData();
  wishForm.set("title", `${MARK} wish`);
  wishForm.set("description", "observation qa");
  const w6 = await api(userA.token, "/api/wishlist", {
    method: "POST",
    body: wishForm,
  });
  const wishId = w6.body?.item?.id;
  record(
    results,
    "W6.A.wishlist.post",
    w6.status === 200 && Boolean(wishId),
    {
      status: w6.status,
      id: wishId,
      originBlock: isOriginBlock(w6),
      error: w6.body?.error,
    },
  );

  if (wishId) {
    const wishPatch = await api(userA.token, "/api/wishlist", {
      method: "PATCH",
      json: { id: wishId, done: true },
    });
    record(
      results,
      "W6b.A.wishlist.patch",
      wishPatch.status === 200 && wishPatch.body?.item?.isDone === true,
      {
        status: wishPatch.status,
        originBlock: isOriginBlock(wishPatch),
        error: wishPatch.body?.error,
      },
    );
  }

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
  const sticker = w7.body?.item;
  record(
    results,
    "W7.A.canvas.post",
    (w7.status === 200 || w7.status === 201) && Boolean(sticker?.id),
    {
      status: w7.status,
      id: sticker?.id,
      revision: sticker?.revision,
      originBlock: isOriginBlock(w7),
      error: w7.body?.error,
    },
  );

  let stickerRevision = sticker?.revision ?? 1;
  if (sticker?.id) {
    const patchOk = await api(
      userA.token,
      `/api/entries/${entryA}/canvas-items/${sticker.id}`,
      {
        method: "PATCH",
        json: { revision: stickerRevision, x_ratio: 0.55, y_ratio: 0.45 },
      },
    );
    record(
      results,
      "W7b.A.canvas.patch",
      patchOk.status === 200 && Boolean(patchOk.body?.item),
      {
        status: patchOk.status,
        revision: patchOk.body?.item?.revision,
        originBlock: isOriginBlock(patchOk),
        error: patchOk.body?.error,
      },
    );
    stickerRevision = patchOk.body?.item?.revision ?? stickerRevision + 1;

    const stale = await api(
      userB.token,
      `/api/entries/${entryA}/canvas-items/${sticker.id}`,
      {
        method: "PATCH",
        json: { revision: 1, x_ratio: 0.1 },
      },
    );
    record(results, "W7c.B.canvas.stale409", stale.status === 409, {
      status: stale.status,
      error: stale.body?.error,
      originBlock: isOriginBlock(stale),
    });

    const recover = await api(
      userA.token,
      `/api/entries/${entryA}/canvas-items/${sticker.id}`,
      {
        method: "PATCH",
        json: {
          revision: stickerRevision,
          x_ratio: 0.6,
        },
      },
    );
    record(
      results,
      "W7d.A.canvas.patch.after409",
      recover.status === 200 && Boolean(recover.body?.item),
      {
        status: recover.status,
        revision: recover.body?.item?.revision,
        error: recover.body?.error,
      },
    );
    stickerRevision = recover.body?.item?.revision ?? stickerRevision;
  }

  const w8 = await api(userA.token, "/api/companion/messages", {
    method: "POST",
    json: {
      body: `${MARK} companion whisper`,
      pagePath: "/home",
      pageTitle: "Home",
    },
  });
  record(
    results,
    "W8.A.companion.post",
    w8.status === 200 && Boolean(w8.body?.message?.id),
    {
      status: w8.status,
      id: w8.body?.message?.id,
      originBlock: isOriginBlock(w8),
      error: w8.body?.error,
    },
  );

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
  record(
    results,
    "X.emoji-usage.post",
    emoji.status === 200 || emoji.status === 201,
    {
      status: emoji.status,
      originBlock: isOriginBlock(emoji),
      error: emoji.body?.error,
    },
  );

  const footprint = await api(userA.token, "/api/footprints", {
    method: "POST",
    json: {
      eventType: "message",
      scope: "page",
      pagePath: "/home",
      pageTitle: "Home",
      body: `${MARK} footprint note`,
    },
  });
  record(
    results,
    "X.footprints.post",
    footprint.status === 200 && !isOriginBlock(footprint),
    {
      status: footprint.status,
      originBlock: isOriginBlock(footprint),
      error: footprint.body?.error,
    },
  );

  const notes = await api(userA.token, "/api/notifications?limit=30");
  if (notes.status === 200) {
    const list = notes.body?.items || notes.body?.notifications || [];
    const firstId =
      Array.isArray(list) && list[0]
        ? list[0].id || list[0].notification_id
        : null;
    if (firstId) {
      const markRead = await api(userA.token, "/api/notifications", {
        method: "PATCH",
        json: { id: firstId },
      });
      record(
        results,
        "X.notifications.patch",
        markRead.status === 200 && !isOriginBlock(markRead),
        {
          status: markRead.status,
          originBlock: isOriginBlock(markRead),
          error: markRead.body?.error,
        },
      );
    } else {
      const markAll = await api(userA.token, "/api/notifications", {
        method: "PATCH",
        json: { all: true },
      });
      record(
        results,
        "X.notifications.patch.all",
        markAll.status === 200 && !isOriginBlock(markAll),
        {
          status: markAll.status,
          originBlock: isOriginBlock(markAll),
          error: markAll.body?.error,
        },
      );
    }
  } else {
    record(results, "X.notifications.get", false, { status: notes.status });
  }

  const inbox = await api(userA.token, "/api/footprints/inbox");
  if (inbox.status === 200) {
    const pending =
      inbox.body?.items ||
      inbox.body?.pending ||
      inbox.body?.entries ||
      [];
    const entryId =
      Array.isArray(pending) && pending[0]
        ? pending[0].entryId || pending[0].entry_id || pending[0].id
        : null;
    if (entryId) {
      const done = await api(userA.token, "/api/footprints/inbox", {
        method: "PATCH",
        json: { entryId },
      });
      record(
        results,
        "X.inbox.patch",
        done.status === 200 && !isOriginBlock(done),
        {
          status: done.status,
          originBlock: isOriginBlock(done),
          error: done.body?.error,
        },
      );
    } else {
      skip(results, "X.inbox.patch", "no pending inbox items");
    }
  } else {
    record(results, "X.inbox.get", false, {
      status: inbox.status,
      error: inbox.body?.error,
    });
  }

  // Throwaway presign + DELETE cleanup (do not leave orphan)
  const throwaway = await api(userA.token, "/api/uploads/presign", {
    method: "POST",
    json: {
      fileName: "obs-qa-throwaway.png",
      mime: "image/png",
      size: 68,
      variant: "original",
    },
  });
  if (throwaway.status === 200 && throwaway.body?.r2Key) {
    const delUpload = await api(userA.token, "/api/uploads/presign", {
      method: "DELETE",
      json: { keys: [throwaway.body.r2Key] },
    });
    record(
      results,
      "X.uploads.presign.delete",
      delUpload.status === 200 && !isOriginBlock(delUpload),
      {
        status: delUpload.status,
        originBlock: isOriginBlock(delUpload),
        error: delUpload.body?.error,
      },
    );
  } else {
    record(results, "X.uploads.presign.throwaway", false, {
      status: throwaway.status,
      error: throwaway.body?.error,
    });
  }

  // Settings: empty title must 400; must NOT change production title
  const settingsBad = new FormData();
  settingsBad.set("title", "");
  const settings = await api(userA.token, "/api/settings", {
    method: "POST",
    body: settingsBad,
  });
  record(
    results,
    "X.settings.emptyTitle",
    settings.status === 400 && !isOriginBlock(settings),
    {
      status: settings.status,
      originBlock: isOriginBlock(settings),
      error: settings.body?.error,
    },
  );

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

  const invalidCookie = await fetch(`${BASE}/api/entries`, {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
      Cookie: `${COOKIE_NAME}=invalid-token`,
    },
    body: (() => {
      const f = new FormData();
      f.set("title", "should-401");
      f.set("body", "x");
      f.set("happened_at", new Date().toISOString());
      f.set("category", "moment");
      f.set("uploaded_media", "[]");
      return f;
    })(),
  });
  const invalidBody = await invalidCookie.json().catch(() => ({}));
  record(
    results,
    "X.invalidSession.write",
    invalidCookie.status === 401,
    { status: invalidCookie.status, error: invalidBody.error },
  );

  return {
    entryA,
    entryB,
    followUpId,
    wishId,
    stickerId: sticker?.id,
    stickerRevision,
  };
}

async function mediaAndDisplay(userA, entryId, results) {
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
  record(
    results,
    "M1.presign",
    presign.status === 200 && Boolean(presign.body?.uploadUrl),
    {
      status: presign.status,
      hasUrl: Boolean(presign.body?.uploadUrl),
      r2Key: Boolean(presign.body?.r2Key),
      originBlock: isOriginBlock(presign),
      error: presign.body?.error,
    },
  );

  let mediaEntryId = null;
  if (presign.status === 200 && presign.body?.uploadUrl && presign.body?.r2Key) {
    const put = await fetch(presign.body.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
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
      const save = await api(userA.token, "/api/entries", {
        method: "POST",
        body: form,
      });
      mediaEntryId = save.body?.id ?? null;
      record(
        results,
        "M3.entries.post.withMedia",
        save.status === 200 && Boolean(mediaEntryId),
        {
          status: save.status,
          id: mediaEntryId,
          originBlock: isOriginBlock(save),
          error: save.body?.error,
        },
      );

      if (mediaEntryId) {
        const detail = await api(userA.token, `/memories/${mediaEntryId}`);
        record(results, "M4.memory.page", detail.status === 200, {
          status: detail.status,
        });
        const list = await api(userA.token, "/api/entries?limit=5");
        const item = list.body?.items?.find((row) => row.id === mediaEntryId);
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
          record(
            results,
            "M6.unsigned.media.denied",
            unauth.status === 403 || unauth.status === 400,
            { status: unauth.status },
          );
          try {
            const u = new URL(mediaUrl);
            const expires =
              u.searchParams.get("X-Amz-Expires") ||
              u.searchParams.get("Expires");
            const expiresNum = Number(expires);
            record(
              results,
              "M7.signed.ttl",
              expiresNum === 3600 || expires === "3600",
              { expires },
            );
            const tampered = mediaUrl.replace(/Signature=[^&]+/i, "Signature=deadbeef");
            const bad = await fetch(tampered);
            record(
              results,
              "M8.tampered.signature.denied",
              bad.status === 403 || bad.status === 400 || bad.status === 401,
              { status: bad.status },
            );
          } catch (error) {
            record(results, "M7.signed.ttl", false, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        } else {
          record(results, "M5.signed.media.get", false, {
            reason: "no media url on list item",
          });
        }
      }
    }
  }

  for (const { path, needles } of PAGE_EXPECTATIONS) {
    const page = await api(userA.token, path);
    const html = typeof page.body === "string" ? page.body : "";
    const hasNeedle = needles.some((n) => html.includes(n));
    const hasMojibake = MOJIBAKE_MARKERS.some((m) => html.includes(m));
    record(
      results,
      `D.html${path}`,
      page.status === 200 && hasNeedle && !hasMojibake,
      {
        status: page.status,
        hasNeedle,
        hasMojibake,
        needles,
      },
    );
  }

  if (entryId) {
    const mem = await api(userA.token, `/memories/${entryId}`);
    const html = typeof mem.body === "string" ? mem.body : "";
    record(
      results,
      "D.html.memory",
      mem.status === 200 &&
        (html.includes("回忆") || html.includes("追评") || html.includes(MARK)) &&
        !MOJIBAKE_MARKERS.some((m) => html.includes(m)),
      { status: mem.status },
    );
  }

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

  const tileUrl =
    "https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x=13680&y=6675&z=14";
  const tile = await fetch(tileUrl);
  const tileType = tile.headers.get("content-type") || "";
  record(
    results,
    "D.amap.tile",
    tile.status === 200 && /image|octet-stream/i.test(tileType),
    { status: tile.status, contentType: tileType },
  );

  const unauthEntries = await fetch(`${BASE}/api/entries`);
  record(results, "S.unauth.entries", unauthEntries.status === 401, {
    status: unauthEntries.status,
  });

  return mediaEntryId;
}

async function collabChecks(userA, userB, entryA, results) {
  const list = await api(userB.token, `/api/entries/${entryA}/follow-ups`);
  record(
    results,
    "C1.B.sees.A.follow-ups",
    list.status === 200 && (list.body?.items?.length ?? 0) > 0,
    { status: list.status, count: list.body?.items?.length },
  );

  const bComment = await api(userB.token, `/api/entries/${entryA}/follow-ups`, {
    method: "POST",
    json: { body: `${MARK} B comments on A` },
  });
  record(
    results,
    "C2.B.follow-up.on.A",
    bComment.status === 200 && Boolean(bComment.body?.item?.id),
    {
      status: bComment.status,
      originBlock: isOriginBlock(bComment),
      error: bComment.body?.error,
    },
  );

  const canvas = await api(userB.token, `/api/entries/${entryA}/canvas-items`);
  record(
    results,
    "C3.B.sees.canvas",
    canvas.status === 200 && (canvas.body?.items?.length ?? 0) > 0,
    { status: canvas.status, count: canvas.body?.items?.length },
  );

  await api(userA.token, "/api/presence", {
    method: "POST",
    json: { currentPath: `/memories/${entryA}`, pageTitle: "Memory" },
  });
  const presence = await api(userB.token, "/api/presence");
  record(results, "C4.presence.summary", presence.status === 200, {
    status: presence.status,
    keys:
      presence.body && typeof presence.body === "object"
        ? Object.keys(presence.body)
        : null,
  });

  const msgs = await api(userB.token, "/api/companion/messages?limit=10");
  const hasObs =
    Array.isArray(msgs.body?.messages) &&
    msgs.body.messages.some((m) => String(m.body || "").includes(MARK));
  record(results, "C5.B.sees.companion", msgs.status === 200 && hasObs, {
    status: msgs.status,
    hasObs,
  });
}

async function finishMutatingCleanup(userA, created, results) {
  if (created?.stickerId && created?.entryA && created?.stickerRevision) {
    const del = await api(
      userA.token,
      `/api/entries/${created.entryA}/canvas-items/${created.stickerId}`,
      {
        method: "DELETE",
        json: { revision: created.stickerRevision },
      },
    );
    record(
      results,
      "W7e.A.canvas.delete",
      del.status === 200 && !isOriginBlock(del),
      {
        status: del.status,
        originBlock: isOriginBlock(del),
        error: del.body?.error,
      },
    );
  }

  if (created?.wishId) {
    const delWish = await api(userA.token, "/api/wishlist", {
      method: "DELETE",
      json: { id: created.wishId },
    });
    record(
      results,
      "W6c.A.wishlist.delete",
      delWish.status === 200 && !isOriginBlock(delWish),
      {
        status: delWish.status,
        originBlock: isOriginBlock(delWish),
        error: delWish.body?.error,
      },
    );
  }
}

async function verifyHomeClean(token, results) {
  const home = await api(token, "/home");
  const html = typeof home.body === "string" ? home.body : "";
  const polluted = html.includes("obs-qa-");
  record(results, "Z.home.noObsQaTitle", home.status === 200 && !polluted, {
    status: home.status,
    polluted,
  });
}

async function measureHotPaths(token, results) {
  const paths = [
    "/api/health",
    "/home",
    "/time/timeline",
    "/api/entries?limit=12",
    "/places/map",
  ];
  const samples = {};
  for (const path of paths) {
    const times = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      const res = await api(token, path);
      times.push({ status: res.status, ms: Math.round(performance.now() - t0) });
    }
    samples[path] = times;
    const ok = times.every((t) => t.status === 200);
    record(results, `PERF${path}`, ok, { times });
  }
  return samples;
}

function writeReport(results, created, extra = {}) {
  const failed = results.filter((r) => !r.pass);
  const summary = {
    ok: failed.length === 0,
    base: BASE,
    mark: MARK,
    at: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: failed.map((r) => r.id),
    skipped: results
      .filter((r) => r.detail && r.detail.skipped)
      .map((r) => ({ id: r.id, reason: r.detail.reason })),
    created,
    ...extra,
    results,
  };
  const outPath = resolve("docs/plans/OBSERVATION_QA_RESULTS.json");
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(
    `\nSummary: ${summary.passed}/${summary.total} passed; wrote ${outPath}`,
  );
  if (failed.length) {
    console.log("Failed:", failed.map((r) => r.id).join(", "));
  }
  return summary;
}

async function main() {
  const results = [];
  console.log(
    JSON.stringify(
      { base: BASE, origin: ORIGIN, mark: MARK, cleanupOnly: CLEANUP_ONLY },
      null,
      2,
    ),
  );

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

  if (CLEANUP_ONLY) {
    await cleanupObsData([userA.token, userB.token], results);
    await verifyHomeClean(userA.token, results);
    const summary = writeReport(results, null);
    if (!summary.ok) process.exit(1);
    return;
  }

  const health = await fetch(`${BASE}/api/health?db=1&auth=1&sharp=1`);
  const healthBody = await health.json().catch(() => ({}));
  const healthOk =
    healthBody?.db?.ok === true && healthBody?.sharp?.ok === true;
  record(results, "0.health.db_sharp", healthOk, {
    http: health.status,
    mode: healthBody.mode,
    db: healthBody.db,
    sharp: healthBody.sharp,
    auth: healthBody.auth,
  });

  const created = await writeGate(userA, userB, results);
  let mediaEntryId = null;
  if (created?.entryA) {
    mediaEntryId = await mediaAndDisplay(userA, created.entryA, results);
    await collabChecks(userA, userB, created.entryA, results);
    await finishMutatingCleanup(userA, created, results);
  }

  const perf = await measureHotPaths(userA.token, results);

  // Code-level polling note (no browser): static expectation recorded as skip evidence
  skip(
    results,
    "P.poll.visibility.code",
    "useVisibilityAwarePolling gates on document.visibilityState===visible; no browser MCP this run",
  );
  skip(
    results,
    "P.bookmarks.device",
    "agent cannot read phone bookmarks",
  );
  skip(
    results,
    "P.coldstart.scaleToZero",
    "not observed scale-to-zero; no fabricated seconds",
  );

  await cleanupObsData([userA.token, userB.token], results);
  // Also delete media entry if cleanup missed (title has obs-qa)
  await cleanupObsData([userA.token, userB.token], null);
  await verifyHomeClean(userA.token, results);

  const summary = writeReport(results, { ...created, mediaEntryId }, { perf });
  if (!summary.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
