import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/config/env";
import * as schema from "./schema";

declare global {
  var __pgPool: Pool | undefined;
  var __db: NodePgDatabase<typeof schema> | undefined;
}

function getPool(): Pool {
  if (!globalThis.__pgPool) {
    globalThis.__pgPool = new Pool({ connectionString: env().DATABASE_URL });
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
