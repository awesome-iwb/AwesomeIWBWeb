const fs = require('fs');
const fixes = [
  ['d:/github/AwesomeIWBWeb/frontend/src/views/admin/MediaView.vue', [
    ["confirm('确认软删除该媒体文件", "confirm('确认软删除该媒体文件？');"],
    ["alert('软删除成", "alert('软删除成功');"],
    ["'软删除失", "'软删除失败'"],
  ]],
  ['d:/github/AwesomeIWBWeb/frontend/src/views/admin/DevelopersView.vue', [
    ['title="暂无开发', 'title="暂无开发者"'],
  ]],
];
for (const [file, pairs] of fixes) {
  let s = fs.readFileSync(file, 'utf8');
  for (const [from, to] of pairs) {
    const idx = s.indexOf(from);
    if (idx >= 0) console.log(file, 'found', from.slice(0,30));
  }
}
