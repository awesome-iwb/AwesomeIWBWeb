import fs from "fs/promises";
import path from "path";
import { sql } from "./client";

type DatabasePool = ReturnType<typeof sql>;
type ReservedConnection = Awaited<ReturnType<DatabasePool["reserve"]>>;
type ReservablePool = Pick<DatabasePool, "reserve">;

export async function withMigrationConnection<T>(
  pool: ReservablePool,
  work: (connection: ReservedConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.reserve();

  try {
    return await work(connection);
  } catch (error) {
    // A migration may own an explicit BEGIN/COMMIT block. If it fails before
    // COMMIT, reset the reserved session before returning it to the pool.
    await connection.unsafe("rollback").catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export async function migrate() {
  const migrationsDir = path.join(import.meta.dir, "../../migrations");
  const entries = await fs.readdir(migrationsDir);
  const files = entries.filter((f) => f.endsWith(".sql")).sort();

  await withMigrationConnection(sql(), async (connection) => {
    await connection`select 1`;
    await connection.unsafe(
      "create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())"
    );

    const applied = await connection<Array<{ version: string }>>`select version from schema_migrations`;
    const appliedSet = new Set(applied.map((r) => r.version));

    for (const file of files) {
      if (appliedSet.has(file)) continue;
      const full = path.join(migrationsDir, file);
      const content = await fs.readFile(full, "utf-8");
      await connection.unsafe(content);
      await connection`insert into schema_migrations(version) values (${file})`;
    }
  });
}

