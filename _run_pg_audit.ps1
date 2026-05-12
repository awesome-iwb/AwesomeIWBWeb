$ErrorActionPreference="Stop"
Import-Module Posh-SSH

if (-not $env:AUDIT_SSH_PASS) {
  throw "请先设置环境变量 AUDIT_SSH_PASS（仅此脚本使用）。"
}

$sec = ConvertTo-SecureString $env:AUDIT_SSH_PASS -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential("root", $sec)
$session = New-SSHSession -ComputerName "210.16.165.251" -Credential $cred -AcceptKey -Port 22
$sid = $session.SessionId

function Q([string]$sql) {
  $cmd = "docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c '{0}'" -f $sql
  $r = Invoke-SSHCommand -SessionId $sid -Command $cmd -TimeOut 3600
  if ($r.ExitStatus -ne 0) {
    return ("EXIT:{0}`nSTDERR:`n{1}`nOUT:`n{2}" -f $r.ExitStatus, $r.Error, (($r.Output | Out-String).Trim()))
  }
  return ($r.Output | Out-String).Trim()
}

$out = New-Object System.Collections.Generic.List[string]

function W([string]$h) {
  $out.Add("`n==================== $h ====================") | Out-Null
}

W "01_overview"
$out.Add((Q 'SELECT current_database(), current_user, version();'))

W "01_db_size"
$out.Add((Q 'SELECT pg_size_pretty(pg_database_size($n$awesomeiwb$n$)) AS db_size;'))

W "02_tables_estimated"
$out.Add((Q 'SELECT n.nspname AS schema, c.relname AS table, pg_size_pretty(pg_total_relation_size(c.oid)) AS size, c.reltuples::bigint AS estimated_rows FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind=$k$r$k$ AND n.nspname NOT IN ($a$pg_catalog$a$, $b$information_schema$b$) ORDER BY pg_total_relation_size(c.oid) DESC;'))

W "03_exact_counts"
$out.Add((Q 'SELECT schemaname, relname AS table, (xpath($xp$/row/c/text()$xp$, xml_count))[1]::text::bigint AS exact_count FROM ( SELECT table_schema AS schemaname, table_name AS relname, query_to_xml(format($f$select count(*)::bigint as c from %I.%I$f$, table_schema, table_name), false, true, NULL::text) AS xml_count FROM information_schema.tables WHERE table_schema NOT IN ($a$pg_catalog$a$, $b$information_schema$b$) AND table_type = $t$BASE TABLE$t$ ) sub ORDER BY exact_count DESC NULLS LAST;'))

W "06_indexes"
$out.Add((Q 'SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes WHERE schemaname=$x$public$x$ ORDER BY tablename, indexname;'))

W "07_constraints"
$out.Add((Q 'SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname=$x$public$x$) AND contype IN ($c1$f$c1$, $c2$u$c2$, $t3$c$t3$) ORDER BY conrelid::regclass::text, conname;'))

W "08_migration_tables_discovery"
$out.Add((Q 'SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema=$x$public$x$ AND (table_name ILIKE $p$%migr%$p$ OR table_name ILIKE $p$%flyway%$p$ OR table_name ILIKE $p$%knex%$p$);'))

W "08_schema_migrations"
$out.Add((Q 'SELECT * FROM schema_migrations;'))

W "08_schema_migrations_columns"
$out.Add((Q 'SELECT ordinal_position, column_name, data_type FROM information_schema.columns WHERE table_schema=$x$public$x$ AND table_name=$x$schema_migrations$x$ ORDER BY ordinal_position;'))

W "09_integrity"
$out.Add((Q 'SELECT $l$projects.slug dup$l$ AS chk, slug::text, count(*)::bigint FROM projects GROUP BY slug HAVING count(*) > 1 UNION ALL SELECT $l$categories.slug dup$l$, slug::text, count(*)::bigint FROM categories GROUP BY slug HAVING count(*) > 1 UNION ALL SELECT $l$users.username dup$l$, username::text, count(*)::bigint FROM users GROUP BY username HAVING count(*) > 1 UNION ALL SELECT $l$project null name$l$, id::text, 1::bigint FROM projects WHERE name IS NULL OR name=$z$$z$ LIMIT 50;'))

W "09_orphan_projects_category_optional"
$out.Add((Q 'SELECT COUNT(*) AS orphan_projects FROM projects p LEFT JOIN categories c ON c.id = p.category_id WHERE p.category_id IS NOT NULL AND c.id IS NULL;'))

W "10_users"
$out.Add((Q 'SELECT id, username, role, created_at, updated_at FROM users ORDER BY created_at;'))

W "10_local_accounts_join_user_id"
$out.Add((Q 'SELECT u.username, length(la.password_hash::text) AS hlen, la.must_change_password, la.failed_attempts, la.locked_until, la.updated_at FROM users u LEFT JOIN local_accounts la ON la.user_id = u.id ORDER BY u.created_at;'))

W "10_local_accounts_join_username"
$out.Add((Q 'SELECT u.username, length(la.password_hash::text) AS hlen, la.must_change_password, la.failed_attempts, la.locked_until, la.updated_at FROM users u LEFT JOIN local_accounts la ON la.username = u.username ORDER BY u.created_at;'))

W "10_sensitive_columns_discovery"
$out.Add((Q 'SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema=$x$public$x$ AND (column_name ILIKE $p$%password%$p$ OR column_name ILIKE $p$%token%$p$ OR column_name ILIKE $p$%secret%$p$ OR column_name ILIKE $p$%session%$p$) ORDER BY table_name, column_name;'))

W "10_api_tokens_count"
$out.Add((Q 'SELECT count(*) FROM api_tokens;'))

W "10_api_tokens_recent_meta"
$out.Add((Q 'SELECT id::text AS id, length(token::text) AS token_len, created_at FROM api_tokens ORDER BY created_at DESC LIMIT 10;'))

W "10_audit_logs_count"
$out.Add((Q 'SELECT count(*) FROM audit_logs;'))

W "10_audit_logs_recent"
$out.Add((Q 'SELECT id, actor_user_id::text AS actor_user_id, action, resource_type, resource_id::text AS resource_id, ip_hash, length(details::text) AS details_len, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10;'))

W "11_non_public_schemas_tables"
$out.Add((Q 'SELECT table_schema, table_name FROM information_schema.tables WHERE table_type=$t$BASE TABLE$t$ AND table_schema NOT IN ($x$pg_catalog$x$, $x$information_schema$x$) ORDER BY table_schema, table_name;'))

W "04_table_list"
$listText = Q 'SELECT tablename FROM pg_tables WHERE schemaname=$x$public$x$ ORDER BY tablename;'
$list = $listText -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ }

foreach ($t in $list) {
  if ($t -notmatch "^[a-zA-Z0-9_]+$") { continue }
  W ("COLS " + $t)
  $colSql = 'SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema=$x$public$x$ AND table_name=$x$' + $t + '$x$ ORDER BY ordinal_position;'
  $out.Add((Q $colSql))
  W ("SAMPLE " + $t)
  $sampleSql = 'SELECT * FROM public.' + $t + ' LIMIT 3;'
  $rawSample = Q $sampleSql
  $out.Add(($rawSample))
}

Remove-SSHSession -SessionId $sid | Out-Null

$outPath = Join-Path $env:TEMP "awesomeiwb_pg_audit_raw.txt"
($out -join "`n") | Set-Content -LiteralPath $outPath -Encoding utf8
Write-Output $outPath
