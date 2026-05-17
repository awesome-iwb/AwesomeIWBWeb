const fs=require('fs');
const files=['MediaView','DevelopersView'];
for (const f of files) {
  const p=`d:/github/AwesomeIWBWeb/frontend/src/views/admin/${f}.vue`;
  const lines=fs.readFileSync(p,'utf8').split(/\n/);
  const nums=f==='MediaView'?[483]:[128,129,130,131];
  for (const n of nums) console.log(f,n, JSON.stringify(lines[n-1]));
}
