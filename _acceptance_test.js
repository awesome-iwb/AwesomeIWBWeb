const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connected! Running acceptance tests...');
  const commands = [
    `echo "=== 1. 上传接口返回契约 ===" && curl -sk https://aiwb.smart-teach.cn/api/upload -X POST 2>&1 | head -1`,
    `echo "=== 2. 媒体引用覆盖率 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT count(*) as total_refs FROM media_references;" 2>&1`,
    `echo "=== 3. 项目媒体引用数 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT count(DISTINCT entity_id) as projects_with_refs FROM media_references WHERE entity_type='project';" 2>&1`,
    `echo "=== 4. 活跃媒体资产总数 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT count(*) as active_assets FROM media_assets WHERE status='active';" 2>&1`,
    `echo "=== 5. 孤儿资产数(无引用) ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT count(*) as orphan_assets FROM media_assets ma WHERE ma.status='active' AND NOT EXISTS (SELECT 1 FROM media_references mr WHERE mr.media_id = ma.id);" 2>&1`,
    `echo "=== 6. 项目总数 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT count(*) as total_projects FROM projects;" 2>&1`,
    `echo "=== 7. HTTPS 首页 ===" && curl -sk -o /dev/null -w "HTTP %{http_code}" https://aiwb.smart-teach.cn/ 2>&1`,
    `echo "=== 8. HTTPS API ===" && curl -sk -o /dev/null -w "HTTP %{http_code}" https://aiwb.smart-teach.cn/api/catalog 2>&1`,
  ];
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) { console.log('\nAll tests done!'); conn.end(); return; }
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
