const fs=require("fs");
const lines=fs.readFileSync("d:/github/AwesomeIWBWeb/frontend/src/views/admin/DevelopersView.vue","utf8").split(/\n/);
for(let i=1;i<=140;i++){
  const l=lines[i-1];
  const q=(l.match(/"/g)||[]).length;
  if(q%2===1) console.log(i, l);
}
