const fs=require("fs");
const p="d:/github/AwesomeIWBWeb/frontend/src/views/admin/DevelopersView.vue";
let lines=fs.readFileSync(p,"utf8").split(/\n/);
const i = lines.findIndex(l=>l.includes("ui-EmptyState") && l.includes("devsPage"));
console.log("i", i);
console.log(JSON.stringify(lines.slice(i, i+5)));
if (i>=0 && lines[i+1].trim()==="</motionless>" && lines[i+2].trim()==="</motionless>") {
  lines.splice(i+2,1);
  fs.writeFileSync(p, lines.join("\n"));
  console.log("removed");
}
