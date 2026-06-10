export type FeedbackActorUser = {
  name?: string | null;
  role?: string | null;
};

export function resolveFeedbackActor(
  payloadActor: unknown,
  user: FeedbackActorUser | null | undefined,
  dbEnabled: boolean
) {
  const actor = typeof payloadActor === "object" && payloadActor ? payloadActor as Record<string, unknown> : {};
  const username = dbEnabled
    ? user?.name
    : actor.username ?? user?.name;
  const role = dbEnabled
    ? user?.role
    : actor.role ?? user?.role;

  return {
    actor_username: String(username ?? "").trim(),
    actor_role: String(role ?? "").trim(),
  };
}
