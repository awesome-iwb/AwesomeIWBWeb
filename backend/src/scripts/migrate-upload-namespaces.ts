/**
 * Retired destructive migration.
 *
 * The original implementation renamed and sometimes deleted files in the
 * legacy uploads directory. Local media v2 intentionally keeps that tree
 * read-only, preserves old /api/uploads aliases, and copies verified bytes to
 * content-addressed objects instead. Leaving this command as a hard failure is
 * safer than allowing an old runbook to mutate the only legacy copy.
 */

export const RETIRED_NAMESPACE_MIGRATION_ERROR =
  "RETIRED_MEDIA_MIGRATION: migrate-upload-namespaces can move/delete legacy files; use media:migrate-v2 (dry-run by default)";

if (import.meta.main) {
  console.error(RETIRED_NAMESPACE_MIGRATION_ERROR);
  process.exit(2);
}
