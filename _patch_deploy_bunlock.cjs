const fs = require("fs");
const p = "d:/github/AwesomeIWBWeb/_deploy_tags_live.cjs";
let s = fs.readFileSync(p, "utf8");
if (!s.includes("backend/bun.lock")) {
  const needle = "{ local: path.join(ROOT, 'backend/package.json'), remote: `${REMOTE}/backend/package.json`, dir: false },";
  const repl = needle + "\n  { local: path.join(ROOT, 'backend/bun.lock'), remote: `${REMOTE}/backend/bun.lock`, dir: false },";
  s = s.replace(needle, repl);
  fs.writeFileSync(p, s);
  console.log("added bun.lock");
} else {
  console.log("bun.lock already listed");
}
