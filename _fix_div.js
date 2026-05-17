const fs = require('fs');
const p = 'd:/github/AwesomeIWBWeb/frontend/src/views/admin/DashboardView.vue';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(
  /(<div v-else class="text-center py-12 text-slate-400 text-sm">[\s\S]*?<\/div>)\n        <\/div>\n      <\/div>\n\n      <LazySection v-if="hasCapability\('story:manage'\)/,
  '$1\n      </div>\n\n      <LazySection v-if="hasCapability(\'story:manage\')'
);
fs.writeFileSync(p, s);
console.log('done');
