import { randomUUID } from "crypto";
import { describe, expect, test } from "bun:test";
import {
  listAgentProjects,
  mapAgentDeveloperDetail,
  mapAgentDeveloperListItem,
  mapAgentProject,
  normalizeAgentPagination,
} from "./agentApi";
import { createProject, deleteProject } from "./projects";

const skipPg = !process.env.DATABASE_URL;

describe("agent API public mappers", () => {
  test("maps projects to public fields only", () => {
    const out = mapAgentProject({
      id: "p1",
      slug: "demo",
      name: "Demo",
      description: "Public app",
      developer: "Alice",
      category_id: "c1",
      category_name: "Tools",
      category_description: "Useful tools",
      keywords: ["whiteboard"],
      recommendation: ["stable"],
      github_url: "https://github.com/a/b",
      icon: "/icon.webp",
      banner: "/banner.webp",
      avatar: "/avatar.webp",
      stars: 42,
      language: "TypeScript",
      status: "active",
      version: "1.0.0",
      last_update: "2026-01-01T00:00:00.000Z",
      ai_usage_state: "under50",
      organization_id: "o1",
      organization_name: "Org",
      developer_user_id: "u1",
      developer_user_name: "Alice",
      developer_user_avatar_url: "/alice.webp",
      email: "private@example.com",
      extra: { hidden: true },
    });

    expect(out.name).toBe("Demo");
    expect(out.category?.name).toBe("Tools");
    expect(out.organization?.name).toBe("Org");
    expect(out.developer_user?.avatar_url).toBe("/alice.webp");
    expect((out as any).email).toBeUndefined();
    expect((out as any).extra).toBeUndefined();
  });

  test("maps developers without email or role leakage", () => {
    const listItem = mapAgentDeveloperListItem({
      id: "u1",
      name: "Alice",
      avatar_url: "/alice.webp",
      email: "private@example.com",
      role: "ops",
      created_at: "2026-01-01T00:00:00.000Z",
      org_count: 1,
      project_count: 2,
      organizations: [{ id: "o1", name: "Org", slug: "org", avatar_url: "/org.webp" }],
    });
    const detail = mapAgentDeveloperDetail({ ...listItem, email: "private@example.com", role: "ops", projects: [] });

    expect(listItem.name).toBe("Alice");
    expect((listItem as any).email).toBeUndefined();
    expect((listItem as any).role).toBeUndefined();
    expect((detail as any).email).toBeUndefined();
    expect((detail as any).role).toBeUndefined();
  });

  test("clamps pagination boundaries", () => {
    expect(normalizeAgentPagination({ page: -10, pageSize: 500 })).toEqual({ page: 1, pageSize: 100 });
    expect(normalizeAgentPagination({ page: "3", pageSize: "2" })).toEqual({ page: 3, pageSize: 2 });
    expect(normalizeAgentPagination({ page: "bad", pageSize: "bad" })).toEqual({ page: 1, pageSize: 20 });
  });
});

describe("agent API project search", () => {
  test.skipIf(skipPg)("matches public project text fields", async () => {
    const marker = `agent-${randomUUID()}`;
    const created = await createProject({
      name: `Agent Search ${marker}`,
      developer: `Developer ${marker}`,
      description: `Description ${marker}`,
      keywords: [`keyword-${marker}`],
      recommendation: [`recommend-${marker}`],
      language: `Language ${marker}`,
    } as any);

    try {
      await expect(listAgentProjects({ q: marker, page: 1, pageSize: 10 })).resolves.toMatchObject({
        total: expect.any(Number),
      });
      const byKeyword = await listAgentProjects({ q: `keyword-${marker}`, page: 1, pageSize: 10 });
      expect(byKeyword.items.some((item) => item.id === created.id)).toBe(true);
      const byRecommendation = await listAgentProjects({ q: `recommend-${marker}`, page: 1, pageSize: 10 });
      expect(byRecommendation.items.some((item) => item.id === created.id)).toBe(true);
    } finally {
      await deleteProject(created.id);
    }
  });
});
