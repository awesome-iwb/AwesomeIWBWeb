import fs from "fs/promises";
import path from "path";
import { sql } from "./client";

export async function migrate() {
  const migrationsDir = path.join(import.meta.dir, "../../migrations");
  const entries = await fs.readdir(migrationsDir);
  const files = entries.filter((f) => f.endsWith(".sql")).sort();

  await sql()`select 1`;
  await sql().unsafe(
    "create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())"
  );

  const applied = await sql()<Array<{ version: string }>>`select version from schema_migrations`;
  const appliedSet = new Set(applied.map((r) => r.version));

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const full = path.join(migrationsDir, file);
    const content = await fs.readFile(full, "utf-8");
    await sql().unsafe(content);
    await sql()`insert into schema_migrations(version) values (${file})`;
  }
}

