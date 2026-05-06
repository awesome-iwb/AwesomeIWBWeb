import fs from "fs";
import path from "path";
import zlib from "zlib";

type Snapshot = Array<{
  schema: {
    data: {
      table: {
        fieldMap: Record<string, any>;
      };
      recordMap: Record<string, Record<string, any>>;
    };
  };
}>;

const repoRoot = path.resolve(__dirname, "../../..");

const args = process.argv.slice(2);
const arg = (key: string) => {
  const idx = args.indexOf(key);
  if (idx === -1) return undefined;
  return args[idx + 1];
};

const inputPath = path.resolve(repoRoot, arg("--input") ?? "docs/ainnnnnnnnnnn.ass");
const outputPath = path.resolve(repoRoot, arg("--output") ?? "backend/src/feishu-import.json");
const mode = (arg("--mode") ?? "filter-approved").trim();

const recommendationFromTags = (tags: string[]) => {
  if (tags.includes("不稳定")) return "不稳定";
  if (tags.includes("稳定")) return "稳定";
  if (tags.includes("画饼")) return "观望中";
  return "";
};

const normalizeCategoryName = (s: string) => {
  return s.replace(/\s+/g, "").replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();
};

const extractPlainText = (cell: any) => {
  if (!cell || typeof cell !== "object") return "";
  const v = (cell as any).value;
  if (!v) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (!x) return "";
        if (typeof x === "string" || typeof x === "number") return String(x);
        if (typeof x.text === "string") return x.text;
        return "";
      })
      .join("")
      .trim();
  }
  return "";
};

const readSelect = (cell: any, optionNameById: Map<string, string>) => {
  if (!cell || typeof cell !== "object") return "";
  const v = (cell as any).value;
  if (typeof v !== "string") return "";
  return optionNameById.get(v) ?? "";
};

const readMultiSelect = (cell: any, optionNameById: Map<string, string>) => {
  if (!cell || typeof cell !== "object") return [] as string[];
  const v = (cell as any).value;
  if (!Array.isArray(v)) return [] as string[];
  return v.map((id) => optionNameById.get(String(id)) ?? "").map((x) => x.trim()).filter(Boolean);
};

const readAiUsageState = (cell: any, optionNameById: Map<string, string>) => {
  const v = readSelect(cell, optionNameById);
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

const ass = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
const raw = Buffer.from(String(ass.gzipSnapshot ?? ""), "base64");
const snapshotJson = zlib.gunzipSync(raw).toString("utf-8");
const snapshot = JSON.parse(snapshotJson) as Snapshot;

if (!Array.isArray(snapshot) || !snapshot.length) {
  throw new Error("Invalid snapshot payload");
}

const src = snapshot[0]?.schema?.data;
if (!src?.table?.fieldMap || !src.recordMap) {
  throw new Error("Snapshot missing table/recordMap");
}

const fieldIdByName = new Map<string, string>();
const optionsByFieldId = new Map<string, Map<string, string>>();

for (const [fid, f] of Object.entries(src.table.fieldMap)) {
  const name = typeof (f as any)?.name === "string" ? String((f as any).name) : "";
  if (name) fieldIdByName.set(name, fid);
  const opts = Array.isArray((f as any)?.property?.options) ? (f as any).property.options : [];
  if (opts.length) {
    const m = new Map<string, string>();
    for (const o of opts) {
      if (typeof o?.id === "string" && typeof o?.name === "string") m.set(o.id, o.name);
    }
    optionsByFieldId.set(fid, m);
  }
}

const fidName = fieldIdByName.get("项目名称");
const fidDev = fieldIdByName.get("开发者");
const fidGithub = fieldIdByName.get("开发者GitHub账号");
const fidDesc = fieldIdByName.get("项目简单介绍");
const fidUrl = fieldIdByName.get("项目地址");
const fidSite = fieldIdByName.get("项目官网");
const fidCategory = fieldIdByName.get("项目类别");
const fidTech = fieldIdByName.get("语言与技术栈");
const fidState = fieldIdByName.get("项目状态");
const fidAudit = fieldIdByName.get("审核状态");
const fidAiOver50 = fieldIdByName.get("项目AI含量是否超过50%");

if (!fidName || !fidUrl || !fidCategory) {
  throw new Error("Snapshot missing required fields: 项目名称 / 项目地址 / 项目类别");
}

const auditOpts = fidAudit ? optionsByFieldId.get(fidAudit) ?? new Map<string, string>() : new Map<string, string>();
const catOpts = optionsByFieldId.get(fidCategory) ?? new Map<string, string>();
const techOpts = fidTech ? optionsByFieldId.get(fidTech) ?? new Map<string, string>() : new Map<string, string>();
const stateOpts = fidState ? optionsByFieldId.get(fidState) ?? new Map<string, string>() : new Map<string, string>();
const aiOpts = fidAiOver50 ? optionsByFieldId.get(fidAiOver50) ?? new Map<string, string>() : new Map<string, string>();

const existingPath = path.resolve(repoRoot, "backend/src/data.json");
const existing = JSON.parse(fs.readFileSync(existingPath, "utf-8"));

const existingCategoryNameByNorm = new Map<string, string>();
for (const c of existing?.categories ?? []) {
  if (typeof c?.name !== "string") continue;
  existingCategoryNameByNorm.set(normalizeCategoryName(c.name), c.name);
}

const categories: Record<string, { name: string; description: string; projects: any[] }> = {};

for (const rec of Object.values(src.recordMap)) {
  if (!rec || typeof rec !== "object") continue;

  if (mode === "filter-approved" && fidAudit) {
    const audit = readSelect((rec as any)[fidAudit], auditOpts);
    if (audit && audit !== "通过") continue;
  }

  const name = extractPlainText((rec as any)[fidName]);
  if (!name) continue;

  const categoryRaw = readSelect((rec as any)[fidCategory], catOpts).trim();
  const categoryNorm = normalizeCategoryName(categoryRaw);
  const categoryName = (existingCategoryNameByNorm.get(categoryNorm) ?? categoryRaw) || "未分类";

  const techs = fidTech ? readMultiSelect((rec as any)[fidTech], techOpts) : [];
  const stateTags = fidState ? readMultiSelect((rec as any)[fidState], stateOpts) : [];
  const language = pickLanguage(techs);
  const ai_usage_state = fidAiOver50 ? readAiUsageState((rec as any)[fidAiOver50], aiOpts) : "unknown";

  const githubUrl = extractPlainText((rec as any)[fidUrl]);
  const website = fidSite ? extractPlainText((rec as any)[fidSite]) : "";
  const developer = fidDev ? extractPlainText((rec as any)[fidDev]) : "";
  const ghAccount = fidGithub ? extractPlainText((rec as any)[fidGithub]) : "";
  const description = fidDesc ? extractPlainText((rec as any)[fidDesc]) : "";

  const recommendation = recommendationFromTags(stateTags);
  const keywords = Array.from(new Set(stateTags)).filter(Boolean);

  const project: any = {
    name,
    developer,
    status: "活跃",
    recommendation,
    ai_usage_state,
    github_url: githubUrl,
    description,
    keywords,
    language,
    avatar: "",
    icon: "",
    banner: "",
    extra: {
      feishu: {
        category: categoryRaw,
        tech_stack: techs,
        project_state_tags: stateTags,
        website,
        github_account: ghAccount
      }
    }
  };

  if (!categories[categoryName]) {
    categories[categoryName] = { name: categoryName, description: "", projects: [] };
  }
  categories[categoryName].projects.push(project);
}

const payload = { categories: Object.values(categories) };
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
console.log(`wrote ${outputPath}`);
