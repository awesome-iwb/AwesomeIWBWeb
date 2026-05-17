const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  const commands = [
    `echo "=== 12. 上传接口可用性 ===" && echo -n "POST /api/upload (无文件): " && curl -sk -o /dev/null -w "%{http_code}" -X POST https://aiwb.smart-teach.cn/api/upload && echo ""`,
    `echo "=== 13. 审核通过后项目图片保留率 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT count(*) as total, count(CASE WHEN icon LIKE '/api/uploads/%' OR icon LIKE '/assets/%' THEN 1 END) as with_icon FROM projects;" 2>&1`,
    `echo "=== 14. 头像更新接口 ===" && echo -n "POST /api/user/avatar (未登录): " && curl -sk -o /dev/null -w "%{http_code}" -X POST https://aiwb.smart-teach.cn/api/user/avatar && echo ""`,
    `echo "=== 15. media_references 覆盖率 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "
      WITH upload_projects AS (
        SELECT count(*) as total FROM projects WHERE icon LIKE '/api/uploads/%' OR banner LIKE '/api/uploads/%' OR avatar LIKE '/api/uploads/%'
      ),
      upload_users AS (
        SELECT count(*) as total FROM users WHERE avatar_url LIKE '/api/uploads/%'
      ),
      ref_projects AS (
        SELECT count(DISTINCT entity_id) as total FROM media_references WHERE entity_type='project'
      ),
      ref_users AS (
        SELECT count(DISTINCT entity_id) as total FROM media_references WHERE entity_type='user'
      )
      SELECT 
        '项目' as type, 
        (SELECT total FROM upload_projects) as should_have, 
        (SELECT total FROM ref_projects) as has_ref,
        CASE WHEN (SELECT total FROM upload_projects) > 0 THEN ROUND(100.0 * (SELECT total FROM ref_projects) / (SELECT total FROM upload_projects)) ELSE 100 END as coverage_pct
      UNION ALL
      SELECT 
        '用户' as type,
        (SELECT total FROM upload_users),
        (SELECT total FROM ref_users),
        CASE WHEN (SELECT total FROM upload_users) > 0 THEN ROUND(100.0 * (SELECT total FROM ref_users) / (SELECT total FROM upload_users)) ELSE 100 END
      ;" 2>&1`,
    `echo "=== 16. 孤儿资产率 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "
      SELECT 
        count(*) as total_active,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM media_references mr WHERE mr.media_id = ma.id)) as orphans,
        ROUND(100.0 * count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM media_references mr WHERE mr.media_id = ma.id)) / count(*)) as orphan_pct
      FROM media_assets ma WHERE ma.status='active';" 2>&1`,
    `echo "=== 17. API健康 ===" && echo -n "/api/projects: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/api/projects && echo "" && echo -n "Home: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/`,
  ];
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) { console.log('\nDone!'); conn.end(); return; }
    conn.exec(commands[idx], (err, stream) => {
      if (err) { console.error('Error:', err.message); idx++; runNext(); return; }
      stream.on('data', (data) => process.stdout.write(data.toString()));
      stream.stderr.on('data', (data) => process.stdout.write(''));
      stream.on('close', () => { idx++; runNext(); });
    });
  }
  runNext();
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
