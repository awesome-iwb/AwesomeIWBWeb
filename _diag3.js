const { Client } = require('ssh2');
const pass = process.env.SSH_PASS;
const cmds = [
  `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "SELECT count(*) AS missing FROM user_capabilities uc WHERE uc.capability_id='admin_panel_access' AND NOT EXISTS (SELECT 1 FROM user_capabilities uc2 WHERE uc2.user_id=uc.user_id AND uc2.capability_id='analytics:read');"`,
  `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "SELECT u.name FROM users u JOIN user_capabilities uc ON u.id=uc.user_id WHERE uc.capability_id='admin_panel_access' AND NOT EXISTS (SELECT 1 FROM user_capabilities x WHERE x.user_id=u.id AND x.capability_id='analytics:read') LIMIT 20;"`,
  `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "SELECT count(*) FROM users WHERE is_superadmin=true;"`,
  `docker exec awesomeiwb-backend wget -qO- http://127.0.0.1:3000/api/health 2>/dev/null || docker exec awesomeiwb-backend node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(console.log)"`,
];
let i=0;
function next(){ if(i>=cmds.length)return; const c=new (require('ssh2').Client)(); c.on('ready',()=>{console.log('\n==='+ (i+1)+'==='); c.exec(cmds[i++],(e,s)=>{s.on('data',d=>process.stdout.write(d)); s.stderr.on('data',d=>process.stderr.write(d)); s.on('close',()=>{c.end();next();});});}).connect({host:'210.16.165.251',port:22,username:'root',password:pass});}
next();
