const fs = require('fs');
const path = 'd:/github/AwesomeIWBWeb/backend/src/data.json';

let content = fs.readFileSync(path, 'utf8');

const rules = [
  ['"recommendation": "🥇 非常推荐"', '"recommendation": "稳定"'],
  ['"recommendation": "🥈 值得尝试"', '"recommendation": "稳定"'],
  ['"recommendation": "🥉 谨慎选择"', '"recommendation": "不稳定"'],
  ['"recommendation": "🧪 观望中"', '"recommendation": "观望中"'],
  ['"recommendation": "🤷‍♂️ 看情况"', '"recommendation": ""'],
];

const counts = {};
for (const [oldStr, newStr] of rules) {
  const regex = new RegExp(oldStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const matches = content.match(regex);
  const count = matches ? matches.length : 0;
  counts[oldStr] = count;
  content = content.replace(regex, newStr);
}

fs.writeFileSync(path, content, 'utf8');

const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log('总共替换了 ' + total + ' 处');
for (const [key, val] of Object.entries(counts)) {
  console.log('  ' + key + ' -> ' + val + ' 处');
}
