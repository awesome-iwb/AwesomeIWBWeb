import fs from "fs";
import path from "path";
import { decodeAssSnapshot, extractTableSnapshot, makeFieldResolver } from "../feishu/baseSnapshot";
import { syncFeishuSnapshotToFileMode, type SyncInputProject } from "../feishu/sync";

const repoRoot = path.resolve(__dirname, "../../..");
const runtimeDir = path.resolve(__dirname, "../../runtime");

const args = process.argv.slice(2);
const arg = (key: string) => {
  const idx = args.indexOf(key);
  if (idx === -1) return undefined;
  return args[idx + 1];
};

const inputPath = path.resolve(repoRoot, arg("--input") ?? "docs/ainnnnnnnnnnn.ass");
const dryRun = args.includes("--dry-run");
const writeSeed = args.includes("--write-seed");
const repairNonFeishuInactive = args.includes("--repair-non-feishu-inactive");

const runtimeDataPath = path.join(runtimeDir, "data.json");
const runtimeSubmissionsPath = path.join(runtimeDir, "submissions.json");
const seedDataPath = path.resolve(__dirname, "../data.json");

const loadJson = <T>(p: string, fallback: T): T => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return fallback;
  }
};

const atomicWriteJson = (p: string, value: any) => {
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `${path.basename(p)}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, p);
};

const readAiUsageState = (v: string) => {
  if (v === "是") return "over50";
  if (v === "否") return "under50";
  return "unknown";
};

const pickLanguage = (techs: string[]) => {
  const known = [
    "TypeScript",
    "JavaScript",
    "C#",
    "C++",
    "C",
    "Java",
    "Python",
    "Go",
    "Rust",
    "Kotlin",
    "Swift",
    "PHP",
    "Ruby",
    "Dart",
    "Lua",
    "Visual Basic"
  ];
  for (const k of known) {
    if (techs.some((t) => t.includes(k))) return k;
  }
  return "";
};

const ass = loadJson<any>(inputPath, null as any);
if (!ass) throw new Error(`input not found: ${inputPath}`);

const snapshot = decodeAssSnapshot(ass);
const { fieldMap, recordMap } = extractTableSnapshot(snapshot);
const r = makeFieldResolver(fieldMap);

const rows: SyncInputProject[] = Object.values(recordMap)
  .map((rec) => {
    const name = r.readText(rec, "项目名称").trim();
    if (!name) return null;
    const category = r.readSingleSelect(rec, "项目类别").replace(/\s+/g, " ").trim();
    const audit = r.readSingleSelect(rec, "审核状态").trim() as any;
    const organization = r.readText(rec, "是否为其他组织旗下产品（不是就不填）").trim();
    const tech = r.readMultiSelect(rec, "语言与技术栈");
    const tags = r.readMultiSelect(rec, "项目状态");
    const aiOver50 = r.readSingleSelect(rec, "项目AI含量是否超过50%");
    return {
      name,
      category: category || "未分类",
      audit_status: audit === "通过" || audit === "待审核" || audit === "未通过" ? audit : "待审核",
      organization,
      developer: r.readText(rec, "开发者").trim(),
      github_account: r.readText(rec, "开发者GitHub账号").trim(),
      github_url: r.readText(rec, "项目地址").trim(),
      website: r.readText(rec, "项目官网").trim(),
      description: r.readText(rec, "项目简单介绍").trim(),
      tech_stack: tech,
      project_state_tags: tags,
      ai_usage_state: readAiUsageState(aiOver50),
      language: pickLanguage(tech)
    } satisfies SyncInputProject;
  })
  .filter(Boolean) as SyncInputProject[];

const seedData = loadJson<any>(seedDataPath, { categories: [] });
const existingData = loadJson<any>(runtimeDataPath, seedData);
const existingSubmissions = loadJson<any[]>(runtimeSubmissionsPath, []);

if (repairNonFeishuInactive) {
  const statusByName = new Map<string, string>();
  for (const c of seedData?.categories ?? []) {
    for (const p of c?.projects ?? []) {
      if (typeof p?.name === "string" && typeof p?.status === "string") statusByName.set(p.name, p.status);
    }
  }

  let repaired = 0;
  for (const c of existingData?.categories ?? []) {
    for (const p of c?.projects ?? []) {
      const hasFeishu = Boolean(p?.extra?.feishu);
      if (hasFeishu) continue;
      if (p?.status !== "不活跃") continue;
      p.status = statusByName.get(String(p?.name ?? "")) ?? "活跃";
      repaired += 1;
    }
  }
  console.log(JSON.stringify({ repairNonFeishuInactive, repaired }, null, 2));
}

const { data, submissions, stats } = syncFeishuSnapshotToFileMode({
  existingData,
  snapshotProjects: rows,
  submissions: existingSubmissions as any
});

console.log(JSON.stringify({ input: inputPath, dryRun, writeSeed, stats }, null, 2));

if (!dryRun) {
  atomicWriteJson(runtimeDataPath, data);
  atomicWriteJson(runtimeSubmissionsPath, submissions);
  if (writeSeed) atomicWriteJson(seedDataPath, data);
}
