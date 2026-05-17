const fs = require('fs');
const p = 'd:/github/AwesomeIWBWeb/frontend/src/views/admin/DevelopersView.vue';
const lines = fs.readFileSync(p, 'utf8').split(/\n/);
const fixes = {
  9: '      >\u5f00\u53d1\u8005</button>',
  31: '        list-title="\u5f00\u53d1\u8005\u5217\u8868"',
  32: '        detail-title="\u5f00\u53d1\u8005\u8be6\u60c5"',
  92: '              <p class="text-slate-400 mb-2">\u4ece\u5217\u8868\u9009\u62e9\u5f00\u53d1\u8005</p>',
  98: '          <input v-model="devQuery" @keyup.enter="fetchDevs" type="text" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-sm" placeholder="\u641c\u7d22\u5f00\u53d1\u8005\u540d\u79f0" />',
};
for (const [n, text] of Object.entries(fixes)) {
  lines[Number(n) - 1] = text + (lines[Number(n)-1].endsWith('\r') ? '\r' : '');
}
fs.writeFileSync(p, lines.join('\n'));
const body = lines.join('\n').split('</template>')[0];
console.log('motionless', (body.match(/<motionless>/g)||[]).length);
console.log('div', (body.match(/<div[\s>]/g)||[]).length, (body.match(/<\/motionless>/g)||[]).length);
console.log('motionless2');
console.log('motionless3');
console.log('div', (body.match(/<div[\s>]/g)||[]).length, (body.match(/<\/div>/g)||[]).length);
