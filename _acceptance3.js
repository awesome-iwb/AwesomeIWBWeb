const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  const commands = [
    `echo "=== 1. 通过上传API上传的项目图片 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT name, icon, banner FROM projects WHERE icon LIKE '/api/uploads/%' OR banner LIKE '/api/uploads/%' OR avatar LIKE '/api/uploads/%';" 2>&1`,
    `echo "=== 2. 有avatar_url的用户 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT id, name, avatar_url FROM users WHERE avatar_url IS NOT NULL AND avatar_url != '';" 2>&1`,
    `echo "=== 3. media_references 详情 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT mr.entity_type, mr.entity_id, mr.field_path, mr.ref_type, ma.url FROM media_references mr JOIN media_assets ma ON mr.media_id = ma.id;" 2>&1`,
    `echo "=== 4. 孤儿资产详情 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT ma.id, ma.url FROM media_assets ma WHERE ma.status='active' AND NOT EXISTS (SELECT 1 FROM media_references mr WHERE mr.media_id = ma.id);" 2>&1`,
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
