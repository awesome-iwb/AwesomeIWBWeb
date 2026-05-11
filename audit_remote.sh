#!/bin/bash
set +e

echo ==================== 01_overview_db ====================
docker exec -i awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb <<'EOSQL'
SELECT current_database(), current_user, version();
EOSQL

echo ==================== 01_overview_size ====================
docker exec -i awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb <<'EOSQL'
SELECT pg_size_pretty(pg_database_size($)) AS db_size;
EOSQL

echo ==================== 02_tables_estimated ====================
docker exec -i awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb <<'EOSQL'
SELECT n.nspname AS schema, c.relname AS table, pg_size_pretty(pg_total_relation_size(c.oid)) AS size, c.reltuples::bigint AS estimated_rows FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind=$ AND n.nspname NOT IN ($, $) ORDER BY pg_total_relation_size(c.oid) DESC;
EOSQL

echo ==================== 03_exact_counts ====================
docker exec -i awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb <<'EOSQL'
SELECT schemaname, relname AS table, (xpath($/row/c/text()$, xml_count))[1]::text::bigint AS exact_count FROM ( SELECT table_schema AS schemaname, table_name AS relname, query_to_xml(format( count(*)::bigint as c from %I.%I$, table_schema, table_name), false, true, NULL::text) AS xml_count FROM information_schema.tables WHERE table_schema NOT IN ($, $) AND table_type =  TABLE$ ) sub ORDER BY exact_count DESC NULLS LAST;
EOSQL
