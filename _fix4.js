const fs = require('fs');
const dv = 'd:/github/AwesomeIWBWeb/frontend/src/views/admin/DevelopersView.vue';
let d = fs.readFileSync(dv, 'utf8');
d = d.replace(/\{\{ dev\.org_count \?\? 0 \}\} [\s\S]*?\/span>/, '{{ dev.org_count ?? 0 }} \u4e2a\u7ec4\u7ec7</span>');
d = d.replace(/\{\{ dev\.project_count \?\? 0 \}\} [\s\S]*?\/span>/, '{{ dev.project_count ?? 0 }} \u4e2a\u9879\u76ee</span>');
d = d.replace(/<ui-EmptyState v-if="devsPage\.items\.length === 0" :icon="UsersIcon" title="[\s\S]*?\/>/, '<ui-EmptyState v-if="devsPage.items.length === 0" :icon="UsersIcon" title="\u6682\u65e0\u5f00\u53d1\u8005" />');
fs.writeFileSync(dv, d);
const body = d.split('</template>')[0];
console.log('motionless', (body.match(/<div[\s>]/g)||[]).length, (body.match(/<\/div>/g)||[]).length);
