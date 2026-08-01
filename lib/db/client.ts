import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DatabaseDriver = "neon-http" | "node-postgres";

/**
 * Call sites were written against the Neon HTTP Drizzle surface.
 * Both drivers share the query builder API we use; cast keeps typings stable.
 */
export type AppDatabase = NeonHttpDatabase<typeof schema>;

function resolveDatabaseDriver(): DatabaseDriver {
  const explicit = process.env.DATABASE_DRIVER?.trim().toLowerCase();
  if (explicit === "neon-http" || explicit === "neon") return "neon-http";
  if (
    explicit === "node-postgres" ||
    explicit === "pg" ||
    explicit === "postgres"
  ) {
    return "node-postgres";
  }

  const url = process.env.DATABASE_URL ?? "";
  if (/neon\.tech|neon\.build/i.test(url)) return "neon-http";
  return "node-postgres";
}

function requireDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("数据库尚未配置：缺少 DATABASE_URL。");
  }
  return databaseUrl;
}

function createNeonHttpDatabase(): AppDatabase {
  return drizzleNeonHttp({
    client: neon(requireDatabaseUrl()),
    schema,
  });
}

function createNodePostgresDatabase(): AppDatabase {
  const pool = new Pool({
    connectionString: requireDatabaseUrl(),
    max: Number(process.env.PGPOOL_MAX || 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    ssl:
      process.env.PGSSL === "disable"
        ? undefined
        : {
            rejectUnauthorized:
              process.env.PGSSL_REJECT_UNAUTHORIZED === "true",
          },
  });

  return drizzleNodePostgres({ client: pool, schema }) as unknown as AppDatabase;
}

let database: AppDatabase | undefined;
let resolvedDriver: DatabaseDriver | undefined;

export function getDatabaseDriver() {
  resolvedDriver ??= resolveDatabaseDriver();
  return resolvedDriver;
}

export function getDatabase(): AppDatabase {
  if (!database) {
    const driver = getDatabaseDriver();
    database =
      driver === "neon-http"
        ? createNeonHttpDatabase()
        : createNodePostgresDatabase();
  }
  return database;
}
