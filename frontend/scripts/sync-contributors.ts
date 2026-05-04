import fs from "fs";
import path from "path";

type ParsedContributor = {
  key: string;
  name: string;
  href: string;
  avatarUrl: string;
};

const frontendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(frontendRoot, "..");
const readmePath = path.resolve(repoRoot, "README.md");
const outputDir = path.resolve(frontendRoot, "public/assets/people/contributors");
const generatedPath = path.resolve(frontendRoot, "src/content/contributors.generated.ts");
const opsOutputDir = path.resolve(frontendRoot, "public/assets/people/ops");
const opsGeneratedPath = path.resolve(frontendRoot, "src/content/ops.generated.ts");
const thanksOutputDir = path.resolve(frontendRoot, "public/assets/people/thanks");
const thanksGeneratedPath = path.resolve(frontendRoot, "src/content/thanks.generated.ts");
const placeholderAvatar = "/assets/people/placeholder.svg";

const operationsTargets = [
  "https://github.com/2-2-3-trimethylpentane",
  "https://github.com/wwiinnddyy",
  "https://github.com/Aris-Offline",
  "https://github.com/xuanxuan1231"
];

const thanksTargets = [
  { href: "https://github.com/Douxiba", name: "Dubi906w", role: "创始人" },
  { href: "https://github.com/jiangyin14", name: "jiangyin14", role: "汇智卓创" }
];

const safeKey = (key: string) => {
  const trimmed = key.trim();
  if (!trimmed) return "unknown";
  const normalized = trimmed.replaceAll(" ", "-");
  const cleaned = normalized.replaceAll(/[^a-zA-Z0-9_.-]/g, "_");
  return cleaned.slice(0, 80);
};

const keyFromHref = (href: string, fallbackName: string) => {
  try {
    const u = new URL(href);
    if (u.hostname === "github.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0]) return safeKey(parts[0]);
    }
  } catch {}
  return safeKey(encodeURIComponent(fallbackName).replaceAll("%", "_"));
};

const normalizeAvatarUrl = (avatarUrl: string) => {
  try {
    const u = new URL(avatarUrl);
    u.searchParams.delete("s");
    u.searchParams.set("size", "128");
    return u.toString();
  } catch {
    return avatarUrl;
  }
};

const extFromContentType = (ct: string | null) => {
  const c = (ct ?? "").toLowerCase();
  if (c.includes("image/webp")) return ".webp";
  if (c.includes("image/png")) return ".png";
  if (c.includes("image/jpeg")) return ".jpg";
  return ".png";
};

const parseContributors = (readme: string): ParsedContributor[] => {
  const start = readme.indexOf("<!-- ALL-CONTRIBUTORS-LIST:START");
  const end = readme.indexOf("<!-- ALL-CONTRIBUTORS-LIST:END -->");
  if (start === -1 || end === -1 || end <= start) throw new Error("ALL-CONTRIBUTORS section not found in README");
  const section = readme.slice(start, end);

  const out: ParsedContributor[] = [];
  const cellRe = /<td[\s\S]*?<a href="([^"]+)"[\s\S]*?<img src="([^"]+)"[\s\S]*?<sub><b>([^<]+)<\/b><\/sub>/g;
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(section))) {
    const href = String(m[1] ?? "").trim();
    const avatarUrl = String(m[2] ?? "").trim();
    const name = String(m[3] ?? "").trim();
    if (!href || !name) continue;
    const key = keyFromHref(href, name);
    out.push({ key, name, href, avatarUrl });
  }
  return out;
};

const downloadAvatar = async (url: string) => {
  const res = await fetch(url, { headers: { "user-agent": "AwesomeIWBWeb" } });
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  const ct = res.headers.get("content-type");
  const ext = extFromContentType(ct);
  const ab = await res.arrayBuffer();
  return { ext, bytes: Buffer.from(ab) };
};

const downloadGithubAvatarToLocal = async (href: string, dir: string, prefix: string) => {
  const key = keyFromHref(href, href);
  const url = normalizeAvatarUrl(`https://github.com/${key}.png`);
  const { ext, bytes } = await downloadAvatar(url);
  const rel = `${prefix}/${key}${ext}`;
  const abs = path.resolve(frontendRoot, `public${rel}`);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, bytes);
  return { key, rel };
};

const main = async () => {
  const readme = fs.readFileSync(readmePath, "utf-8");
  const contributors = parseContributors(readme);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(path.dirname(generatedPath), { recursive: true });
  fs.mkdirSync(opsOutputDir, { recursive: true });
  fs.mkdirSync(path.dirname(opsGeneratedPath), { recursive: true });
  fs.mkdirSync(thanksOutputDir, { recursive: true });
  fs.mkdirSync(path.dirname(thanksGeneratedPath), { recursive: true });

  const results: Array<{ key: string; name: string; href: string; avatar: string }> = [];
  for (const c of contributors) {
    const avatarRemote = normalizeAvatarUrl(c.avatarUrl);
    let avatarPath = placeholderAvatar;
    try {
      const { ext, bytes } = await downloadAvatar(avatarRemote);
      const rel = `/assets/people/contributors/${c.key}${ext}`;
      const abs = path.resolve(frontendRoot, `public${rel}`);
      if (!fs.existsSync(abs)) fs.writeFileSync(abs, bytes);
      avatarPath = rel;
    } catch {
      avatarPath = placeholderAvatar;
    }
    results.push({ key: c.key, name: c.name, href: c.href, avatar: avatarPath });
  }

  const content =
    `export type Contributor = {\n` +
    `  key: string;\n` +
    `  name: string;\n` +
    `  href: string;\n` +
    `  avatar: string;\n` +
    `};\n\n` +
    `export const contributors: Contributor[] = ${JSON.stringify(results, null, 2)};\n`;

  fs.writeFileSync(generatedPath, content, "utf-8");

  const contributorByKey = new Map<string, { key: string; name: string; href: string; avatar: string }>();
  for (const c of results) contributorByKey.set(c.key, c);

  const ops: Array<{ key: string; name: string; href: string; avatar: string }> = [];
  for (const href of operationsTargets) {
    try {
      const u = new URL(href);
      const key = u.pathname.split("/").filter(Boolean)[0] ?? "";
      if (!key) continue;
      const { rel } = await downloadGithubAvatarToLocal(href, opsOutputDir, "/assets/people/ops");
      ops.push({ key, name: key, href: `https://github.com/${key}`, avatar: rel });
    } catch {
      continue;
    }
  }

  const opsContent =
    `export type OpsMember = {\n` +
    `  key: string;\n` +
    `  name: string;\n` +
    `  href: string;\n` +
    `  avatar: string;\n` +
    `};\n\n` +
    `export const operations: OpsMember[] = ${JSON.stringify(ops, null, 2)};\n`;

  fs.writeFileSync(opsGeneratedPath, opsContent, "utf-8");

  const thanks: Array<{ key: string; name: string; href: string; avatar: string; role: string }> = [];
  for (const t of thanksTargets) {
    const key = keyFromHref(t.href, t.name);
    const fromContrib = contributorByKey.get(key);
    if (fromContrib?.avatar) {
      thanks.push({ key, name: t.name, href: t.href, avatar: fromContrib.avatar, role: t.role });
      continue;
    }
    try {
      const { rel } = await downloadGithubAvatarToLocal(t.href, thanksOutputDir, "/assets/people/thanks");
      thanks.push({ key, name: t.name, href: t.href, avatar: rel, role: t.role });
    } catch {
      thanks.push({ key, name: t.name, href: t.href, avatar: placeholderAvatar, role: t.role });
    }
  }

  const thanksContent =
    `export type ThanksMember = {\n` +
    `  key: string;\n` +
    `  name: string;\n` +
    `  href: string;\n` +
    `  avatar: string;\n` +
    `  role: string;\n` +
    `};\n\n` +
    `export const thanks: ThanksMember[] = ${JSON.stringify(thanks, null, 2)};\n`;

  fs.writeFileSync(thanksGeneratedPath, thanksContent, "utf-8");
  console.log(
    JSON.stringify(
      {
        contributors: { count: results.length, generated: path.relative(frontendRoot, generatedPath) },
        operations: { count: ops.length, generated: path.relative(frontendRoot, opsGeneratedPath) },
        thanks: { count: thanks.length, generated: path.relative(frontendRoot, thanksGeneratedPath) }
      },
      null,
      2
    )
  );
};

await main();
