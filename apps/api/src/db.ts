import { neon } from "@neondatabase/serverless";
import type { Bindings } from "./types";

export type SqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

let sqlOverride: SqlClient | null = null;

/** Test-only: inject a mock SQL client (see apps/api/test). */
export function setSqlOverride(sql: SqlClient | null) {
  sqlOverride = sql;
}

export function getSql(env: Bindings): SqlClient {
  if (sqlOverride) {
    return sqlOverride;
  }
  return neon(env.DATABASE_URL) as SqlClient;
}
