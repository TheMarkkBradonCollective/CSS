#!/usr/bin/env node
/**
 * Apply SQL migrations to Neon using DATABASE_URL from the environment.
 * Usage: DATABASE_URL=postgres://... npm run migrate
 */
import { Pool, neon } from "@neondatabase/serverless";
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "migrations");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = neon(url);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const id = file;
    const applied = await sql`
      SELECT 1 FROM schema_migrations WHERE id = ${id}
    `;
    if (applied.length > 0) {
      console.log(`skip ${id}`);
      continue;
    }

    const body = await readFile(join(migrationsDir, file), "utf8");
    const pool = new Pool({ connectionString: url });
    await pool.query(body);
    await pool.end();
    await sql`INSERT INTO schema_migrations (id) VALUES (${id})`;
    console.log(`applied ${id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
