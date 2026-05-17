const fs=require("fs");
const p="d:/github/AwesomeIWBWeb/frontend/src/views/admin/DevelopersView.vue";
let lines=fs.readFileSync(p,"utf8").split(/\n/);
const i = lines.findIndex(l=>l.includes("ui-EmptyState") && l.includes("devsPage"));
lines.splice(i+2, 1);
fs.writeFileSync(p, lines.join("\n"));
console.log("after", lines.slice(i, i+4));
