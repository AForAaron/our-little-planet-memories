#!/usr/bin/env node
/**
 * Seed CloudBase PG with the two Neon profile UUIDs and auth_identity_map rows.
 *
 * Env:
 *   DATABASE_URL — CloudBase PG (public is OK for one-shot seed)
 *   PGSSL=disable (typical for CloudBase public endpoint)
 *   CLOUDBASE_ENV_ID + test emails/passwords from .env.cloudbase.auth.local
 *   Optional: PROFILE_ID_1 / PROFILE_ID_2 (defaults to known Neon production IDs)
 *   Optional: DISPLAY_NAME_1 / DISPLAY_NAME_2
 *
 * Does NOT truncate Neon. Does NOT overwrite profile rows if they already exist.
 */
import pg from "pg";

const PROFILE_1 =
  process.env.PROFILE_ID_1 || "f811c24f-9097-4f72-98df-93df683baf60";
const PROFILE_2 =
  process.env.PROFILE_ID_2 || "bbb50e53-a570-42a6-8a15-e80466b38b92";
const NAME_1 = process.env.DISPLAY_NAME_1 || "张国瑞🌸";
const NAME_2 = process.env.DISPLAY_NAME_2 || "鲨鱼妹💕";

function authBase() {
  const envId = process.env.CLOUDBASE_ENV_ID;
  if (!envId) throw new Error("CLOUDBASE_ENV_ID required");
  return `https://${envId}.api.tcloudbasegateway.com/auth`;
}

async function resolveUid(email, password) {
  const res = await fetch(`${authBase()}/v1/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-device-id": "seed-auth-identity",
    },
    body: JSON.stringify({ username: email, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.sub) {
    throw new Error(`signin failed for ${email.replace(/^(.).+(@.+)$/, "$1***$2")}: ${data.code || res.status}`);
  }
  return String(data.sub);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const email1 = process.env.CLOUDBASE_TEST_EMAIL_1;
  const pass1 = process.env.CLOUDBASE_TEST_PASSWORD_1;
  const email2 = process.env.CLOUDBASE_TEST_EMAIL_2;
  const pass2 = process.env.CLOUDBASE_TEST_PASSWORD_2;
  if (!email1 || !pass1 || !email2 || !pass2) {
    throw new Error("CLOUDBASE_TEST_EMAIL_/PASSWORD_1/2 required");
  }

  const uid1 = await resolveUid(email1, pass1);
  const uid2 = await resolveUid(email2, pass2);

  const ssl =
    process.env.PGSSL === "disable"
      ? false
      : { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== "false" };

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl,
  });
  await client.connect();
  try {
    await client.query("begin");
    for (const row of [
      { id: PROFILE_1, name: NAME_1 },
      { id: PROFILE_2, name: NAME_2 },
    ]) {
      await client.query(
        `insert into profiles (id, display_name, theme)
         values ($1, $2, 'light')
         on conflict (id) do nothing`,
        [row.id, row.name],
      );
    }
    for (const row of [
      { uid: uid1, profileId: PROFILE_1, email: email1 },
      { uid: uid2, profileId: PROFILE_2, email: email2 },
    ]) {
      await client.query(
        `insert into auth_identity_map (provider, provider_user_id, profile_id, email, updated_at)
         values ('cloudbase', $1, $2, $3, now())
         on conflict on constraint auth_identity_map_provider_user_pk
         do update set profile_id = excluded.profile_id,
                       email = excluded.email,
                       updated_at = now()`,
        [row.uid, row.profileId, row.email],
      );
    }
    await client.query("commit");

    const counts = await client.query(
      `select
         (select count(*)::int from profiles) as profiles,
         (select count(*)::int from auth_identity_map where provider='cloudbase') as maps`,
    );
    console.log(
      JSON.stringify(
        {
          ok: true,
          profiles: counts.rows[0].profiles,
          cloudbaseMaps: counts.rows[0].maps,
          mapped: [
            { uid: uid1, profileId: PROFILE_1 },
            { uid: uid2, profileId: PROFILE_2 },
          ],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
