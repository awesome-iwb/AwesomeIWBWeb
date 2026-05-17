const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  const commands = [
    `echo "=== 1. 媒体引用总数 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT count(*) FROM media_references;" 2>&1`,
    `echo "=== 2. 项目媒体引用覆盖 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT count(DISTINCT entity_id) FROM media_references WHERE entity_type='project';" 2>&1`,
    `echo "=== 3. 项目总数 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT count(*) FROM projects;" 2>&1`,
    `echo "=== 4. 活跃媒体资产 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT count(*) FROM media_assets WHERE status='active';" 2>&1`,
    `echo "=== 5. 孤儿资产(无引用) ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT count(*) FROM media_assets ma WHERE ma.status='active' AND NOT EXISTS (SELECT 1 FROM media_references mr WHERE mr.media_id = ma.id);" 2>&1`,
    `echo "=== 6. 用户头像引用覆盖 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT count(DISTINCT entity_id) FROM media_references WHERE entity_type='user';" 2>&1`,
    `echo "=== 7. 故事引用覆盖 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT count(DISTINCT entity_id) FROM media_references WHERE entity_type='story';" 2>&1`,
    `echo "=== 8. API健康检查 ===" && echo -n "/api/projects: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/api/projects && echo "" && echo -n "Home: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/`,
  ];
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) { console.log('\nAll done!'); conn.end(); return; }
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
