import { describe, expect, test } from "bun:test";
import { resolveFeedbackActor } from "./feedbackActor";

describe("resolveFeedbackActor", () => {
  test("uses authenticated user in DB mode", () => {
    expect(resolveFeedbackActor(
      { username: "admin", role: "ops" },
      { name: "alice", role: "user" },
      true,
    )).toEqual({ actor_username: "alice", actor_role: "user" });
  });

  test("keeps JSON mode payload compatibility", () => {
    expect(resolveFeedbackActor(
      { username: "legacy", role: "dev" },
      { name: "alice", role: "user" },
      false,
    )).toEqual({ actor_username: "legacy", actor_role: "dev" });
  });
});
