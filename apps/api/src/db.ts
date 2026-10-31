import { neon } from "@neondatabase/serverless";
import type { Bindings } from "./types";

export function getSql(env: Bindings) {
  return neon(env.DATABASE_URL);
}

export type Sql = ReturnType<typeof getSql>;
