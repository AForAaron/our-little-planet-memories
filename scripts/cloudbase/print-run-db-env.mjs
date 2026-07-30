#!/usr/bin/env node
/**
 * Build CloudBase Run env values from local .env.cloudbase.local (public host)
 * rewriting host to intranet for same-environment Run.
 * Prints a console-ready list; never prints the password in --safe mode.
 *
 *   node --env-file=.env.cloudbase.local scripts/cloudbase/print-run-db-env.mjs --safe
 *   node --env-file=.env.cloudbase.local scripts/cloudbase/print-run-db-env.mjs --write-run-env
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("缺少 DATABASE_URL");
  process.exit(1);
}

const safe = process.argv.includes("--safe");
const writeRunEnv = process.argv.includes("--write-run-env");
const intranetHost = process.env.CLOUDBASE_PG_INTRANET_HOST || "172.17.0.4";
const intranetPort = process.env.CLOUDBASE_PG_INTRANET_PORT || "5432";

const parsed = new URL(url);
const user = decodeURIComponent(parsed.username);
const password = decodeURIComponent(parsed.password);
const database = parsed.pathname.replace(/^\//, "") || "postgres";

const intranetUrl = new URL(`postgresql://${intranetHost}:${intranetPort}/${database}`);
intranetUrl.username = user;
intranetUrl.password = password;
intranetUrl.searchParams.set("sslmode", "disable");

const lines = [
  "APP_DATA_MODE=demo",
  "DATABASE_DRIVER=node-postgres",
  `DATABASE_URL=${intranetUrl.toString()}`,
  "PGSSL=disable",
  "PGPOOL_MAX=3",
];

if (writeRunEnv) {
  const out = path.resolve(process.cwd(), ".env.cloudbase.run.local");
  writeFileSync(out, `${lines.join("\n")}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ ok: true, wrote: out, user, host: intranetHost, port: intranetPort }, null, 2));
  process.exit(0);
}

if (safe) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        copyToCloudBaseRunEnv: {
          APP_DATA_MODE: "demo",
          DATABASE_DRIVER: "node-postgres",
          PGSSL: "disable",
          PGPOOL_MAX: "3",
          DATABASE_URL: `postgresql://${user}:***@${intranetHost}:${intranetPort}/${database}?sslmode=disable`,
        },
        note: "在控制台粘贴完整 DATABASE_URL（用本机 .env.cloudbase.local 密码）。然后重新部署并访问 /api/health?db=1",
      },
      null,
      2,
    ),
  );
} else {
  for (const line of lines) console.log(line);
}
