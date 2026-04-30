export type AiUsageState = "unknown" | "over50" | "under50";

/**
 * Parse a user-provided value into a valid {@link AiUsageState}.
 *
 * - Unknown / invalid values collapse to `"unknown"`.
 * - This function is intentionally permissive so API payloads and JSON data can be sanitized at the boundary.
 */
export function parseAiUsageState(value: unknown): AiUsageState {
  if (value === "unknown" || value === "over50" || value === "under50") return value;
  return "unknown";
}

/**
 * Read the explicit `ai_usage_state` field if present.
 *
 * This is used to preserve a deliberate `"unknown"` value when the field exists.
 * If the field is missing entirely, returns `undefined` so callers can fall back
 * to legacy flags.
 */
export function readAiUsageStateField(project: any): AiUsageState | undefined {
  if (project && typeof project === "object" && "ai_usage_state" in project) {
    return parseAiUsageState((project as any).ai_usage_state);
  }
  return undefined;
}

/**
 * Normalize a project's AI usage state to a stable tri-state:
 *
 * - Prefer explicit `ai_usage_state` when present (even if it is `"unknown"`).
 * - Otherwise fall back to legacy booleans:
 *   - `ai_generated: true` → `"over50"`
 *   - `human_verified: true` → `"under50"`
 * - Default to `"unknown"`.
 *
 * This lets the API and frontend work against a single field while staying
 * backward compatible with older data dumps.
 */
export function normalizeAiUsageState(project: any): AiUsageState {
  const explicit = readAiUsageStateField(project);
  if (explicit) return explicit;
  if (project?.ai_generated === true) return "over50";
  if (project?.human_verified === true) return "under50";
  return "unknown";
}
