import { describe, expect, test } from "bun:test";
import fs from "fs";
import path from "path";
import { decodeAssSnapshot, extractTableSnapshot, makeFieldResolver } from "./baseSnapshot";
import { syncFeishuSnapshotToFileMode, type SyncInputProject } from "./sync";

const fixturePath = path.resolve(__dirname, "../../../docs/ainnnnnnnnnnn.ass");

describe("feishu base snapshot", () => {
  test("decodes gzipSnapshot and extracts table+recordMap", () => {
    const ass = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
    const snapshot = decodeAssSnapshot(ass);
    const { fieldMap, recordMap } = extractTableSnapshot(snapshot);
    expect(Object.keys(fieldMap).length).toBeGreaterThan(10);
    expect(Object.keys(recordMap).length).toBe(37);
  });

  test("field resolver reads text/single/multi select", () => {
    const ass = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
    const snapshot = decodeAssSnapshot(ass);
    const { fieldMap, recordMap } = extractTableSnapshot(snapshot);
    const r = makeFieldResolver(fieldMap);
    const first = recordMap[Object.keys(recordMap)[0]];
    expect(r.readText(first, "项目名称").length).toBeGreaterThan(0);
    expect(["通过", "未通过", "待审核", ""]).toContain(r.readSingleSelect(first, "审核状态"));
    expect(Array.isArray(r.readMultiSelect(first, "语言与技术栈"))).toBe(true);
  });
});

describe("feishu sync (file mode)", () => {
  test("marks missing projects as inactive only when stale by last_update", () => {
    const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const before: any = {
      categories: [
        {
          id: "c1",
          name: "A",
          description: "",
          projects: [{ name: "Old", developer: "", github_url: "", description: "", keywords: [], status: "活跃", last_update: oldDate }]
        }
      ]
    };
    const snapshotProjects: SyncInputProject[] = [{ name: "New", category: "屏幕批注与白板软件", audit_status: "通过", organization: "" }];
    const result = syncFeishuSnapshotToFileMode({ existingData: before, snapshotProjects, submissions: [] });
    const old = result.data.categories[0].projects.find((p: any) => p.name === "Old");
    expect(old.status).toBe("不活跃");
  });

  test("keeps missing projects active when not stale", () => {
    const recentDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const before: any = {
      categories: [
        { id: "c1", name: "A", description: "", projects: [{ name: "Old", developer: "", github_url: "", description: "", keywords: [], status: "活跃", last_update: recentDate }] }
      ]
    };
    const snapshotProjects: SyncInputProject[] = [{ name: "New", category: "屏幕批注与白板软件", audit_status: "通过", organization: "" }];
    const result = syncFeishuSnapshotToFileMode({ existingData: before, snapshotProjects, submissions: [] });
    const old = result.data.categories[0].projects.find((p: any) => p.name === "Old");
    expect(old.status).toBe("活跃");
  });

  test("pending/rejected become submissions and do not enter catalog", () => {
    const before: any = { categories: [{ id: "c1", name: "A", description: "", projects: [] }] };
    const snapshotProjects: SyncInputProject[] = [
      { name: "P1", category: "屏幕批注与白板软件", audit_status: "待审核", organization: "" },
      { name: "P2", category: "屏幕批注与白板软件", audit_status: "未通过", organization: "" }
    ];
    const out = syncFeishuSnapshotToFileMode({ existingData: before, snapshotProjects, submissions: [] });
    expect(out.submissions.some((s: any) => String(s.payload?.name) === "P1" && s.status === "pending")).toBe(true);
    expect(out.submissions.some((s: any) => String(s.payload?.name) === "P2" && s.status === "rejected")).toBe(true);
    const names = out.data.categories.flatMap((c: any) => c.projects.map((p: any) => p.name));
    expect(names.includes("P1")).toBe(false);
    expect(names.includes("P2")).toBe(false);
  });
});
