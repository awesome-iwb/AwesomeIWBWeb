const fs = require('fs');
const p = 'd:/github/AwesomeIWBWeb/frontend/src/lib/renderArticleContent.ts';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(
  /export const INTERVIEW_BLOCK_SNIPPET = `[\s\S]*?`;/,
  `export const INTERVIEW_BLOCK_SNIPPET = \`<!-- interview-block -->
<div class="interview-block">
  <h3 class="interview-q">问：在这里写问题</h3>
  <div class="interview-a">
    <blockquote>在这里写回答或引述</blockquote>
  </div>
</div>
\`;`
);
fs.writeFileSync(p, s, 'utf8');
