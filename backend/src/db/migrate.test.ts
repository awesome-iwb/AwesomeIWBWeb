import { expect, mock, test } from "bun:test";
import postgres from "postgres";
import { withMigrationConnection } from "./migrate";

type MigrationPool = Parameters<typeof withMigrationConnection>[0];
type MigrationConnection = Awaited<ReturnType<MigrationPool["reserve"]>>;

function fakePool(options: { rollbackError?: Error } = {}) {
  const unsafe = mock(async (query: string) => {
    if (query === "rollback" && options.rollbackError) throw options.rollbackError;
    return [];
  });
  const release = mock(() => undefined);
  const connection = Object.assign(mock(async () => []), {
    unsafe,
    release,
  }) as unknown as MigrationConnection;
  const reserve = mock(async () => connection);

  return {
    connection,
    pool: { reserve } as MigrationPool,
    release,
    reserve,
    unsafe,
  };
}

test("migration connection is reserved and released after success", async () => {
  const fixture = fakePool();

  const result = await withMigrationConnection(fixture.pool, async (connection) => {
    expect(connection).toBe(fixture.connection);
    return "done";
  });

  expect(result).toBe("done");
  expect(fixture.reserve).toHaveBeenCalledTimes(1);
  expect(fixture.unsafe).not.toHaveBeenCalled();
  expect(fixture.release).toHaveBeenCalledTimes(1);
});

test("failed migration rolls back and releases its reserved connection", async () => {
  const fixture = fakePool();
  const migrationError = new Error("migration failed");

  await expect(
    withMigrationConnection(fixture.pool, async () => {
      throw migrationError;
    }),
  ).rejects.toBe(migrationError);

  expect(fixture.unsafe).toHaveBeenCalledWith("rollback");
  expect(fixture.release).toHaveBeenCalledTimes(1);
});

test("rollback failure does not hide the original migration error", async () => {
  const fixture = fakePool({ rollbackError: new Error("rollback failed") });
  const migrationError = new Error("migration failed");

  await expect(
    withMigrationConnection(fixture.pool, async () => {
      throw migrationError;
    }),
  ).rejects.toBe(migrationError);

  expect(fixture.release).toHaveBeenCalledTimes(1);
});

const migrationTestDatabaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const postgresTest = migrationTestDatabaseUrl ? test : test.skip;

postgresTest("reserved pooled connection accepts an explicit transaction script", async () => {
  const pool = postgres(migrationTestDatabaseUrl!, { max: 10 });

  try {
    await withMigrationConnection(pool, async (connection) => {
      await connection.unsafe("begin; select 1; commit;");
    });
    const rows = await pool<Array<{ ok: number }>>`select 1 as ok`;
    expect(rows[0]?.ok).toBe(1);
  } finally {
    await pool.end({ timeout: 5 });
  }
});
