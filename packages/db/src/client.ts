import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  var __pgPool: Pool | undefined;
  var __db: NodePgDatabase<typeof schema> | undefined;
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

function getPool(): Pool {
  if (!globalThis.__pgPool) {
    globalThis.__pgPool = new Pool({ connectionString: requireDatabaseUrl() });
  }
  return globalThis.__pgPool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!globalThis.__db) {
    globalThis.__db = drizzle(getPool(), { schema });
  }
  return globalThis.__db;
}

export { schema };
