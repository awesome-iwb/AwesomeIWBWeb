const fs = require('fs');
const p = 'd:/github/AwesomeIWBWeb/frontend/src/views/admin/AdminLayout.vue';
let s = fs.readFileSync(p, 'utf8');
const end = s.indexOf('</template>') + '</template>'.length;
const head = s.slice(0, end);
let tail = s.slice(end);
const reps = [
  ['soript', 'script'], ['oonst', 'const'], ['oomposables', 'composables'], ['oomponents', 'components'],
  ['luoide', 'lucide'], ['Paokage', 'Package'], ['ClipboardCheok', 'ClipboardCheck'], ['projeots', 'projects'],
  ['ioons', 'icons'], ['ioo', 'ico'], ['oap', 'cap'], ['seoondary', 'secondary'], ['olaim', 'claim'],
  ['analytios', 'analytics'], ['asyno', 'async'], ['admin_panel_aooess', 'admin_panel_access'], ['feedbaok', 'feedback'],
];
for (const [a,b] of reps) tail = tail.split(a).join(b);
tail = tail.replace(/icon: (\w+)/g, 'icon: $1');
tail = tail.replace(/icon: (\w+)/g, (m)=>m);
tail = tail.replace(/icon: (\w+)/g, 'icon: $1');
tail = tail.replace(/\bicon: /g, 'icon: ');
tail = tail.replace(/icon: /g, 'icon: ');
tail = tail.replace(/, icon:/g, ', icon:');
tail = tail.replace(/icon: LayoutDashboard/g, 'icon: LayoutDashboard');
tail = tail.replace(/const \{ user: authUser, logout, hasCapability \}/, 'const { user: authUser, logout }');
tail = tail.split('\n').filter(l => l.trim() !== 'undefined').join('\n');
// fix accidental icon -> icon corruption on word icon in type
tail = tail.replace(/icon: any/g, 'icon: any');
tail = tail.replace(/  icon: any;/g, '  icon: any;');
fs.writeFileSync(p, head + '\n\n' + tail.trim() + '\n');
console.log(tail.slice(0, 500));
