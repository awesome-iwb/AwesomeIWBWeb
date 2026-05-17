const fs=require("fs");
const p="d:/github/AwesomeIWBWeb/frontend/src/views/admin/DevelopersView.vue";
let lines=fs.readFileSync(p,"utf8").split(/\n/);
for (let i=0;i<lines.length;i++) {
  if (lines[i].includes("ui-EmptyState") && lines[i+1] && lines[i+1].trim()==="</div>") {
    if (lines[i+2] && lines[i+2].trim()==="</motionless>") { /* wrong */ }
  }
}
// find pattern: EmptyState line then two closing divs before </template>
const i = lines.findIndex(l=>l.includes("ui-EmptyState") && l.includes("?????"));
if (i>=0 && lines[i+1].trim()==="</div>" && lines[i+2].trim()==="</div>") {
  lines.splice(i+2,1);
  fs.writeFileSync(p, lines.join("\n"));
  console.log("removed extra after EmptyState at", i+3);
} else console.log("pattern not found", i, lines.slice(i,i+4));
