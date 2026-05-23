/**
 * Sync stars, version, last_update, status, releases from GitHub for all projects.
 * bun run src/scripts/sync-github-stats.ts
 */
import { migrate } from "../db/migrate";
import { runGithubProjectSync } from "../services/githubSyncJob";

async function main() {
  await migrate();
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : undefined;
  const dryRun = process.env.DRY_RUN === "1";
  const result = await runGithubProjectSync({ limit, dryRun, trigger: "script" });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
