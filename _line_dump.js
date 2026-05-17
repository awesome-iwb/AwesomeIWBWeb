const fs=require('fs');
const lines=fs.readFileSync('d:/github/AwesomeIWBWeb/frontend/src/views/admin/MediaView.vue','utf8').split(/\n/);
for (const n of [413,414,415,427,428,429,482,503,504,505,506]) {
  const l=lines[n-1];
  console.log(n, l);
  console.log('  codes tail', [...l.slice(-20)].map(c=>c.charCodeAt(0)));
}
