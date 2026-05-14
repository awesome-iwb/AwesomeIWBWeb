const { Client } = require('ssh2');

const host = '210.16.165.251';
const username = 'root';
const password = '8EGZ4jf3vumREH';

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (d) => (stdout += d.toString()));
      stream.stderr.on('data', (d) => (stderr += d.toString()));
      stream.on('close', (code) => resolve({ code, stdout, stderr, cmd }));
    });
  });
}

function parseHeaderBlock(raw) {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const statusLine = lines[0] || '';
  const headers = {};
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!headers[key]) headers[key] = [];
    headers[key].push(value);
  }
  return { statusLine, headers };
}

function hasValue(headers, key, expectedPart) {
  const values = headers[key] || [];
  return values.some((v) => v.toLowerCase().includes(expectedPart.toLowerCase()));
}

async function fetchHeaders(conn, url) {
  const cmd = `curl -sSI ${url}`;
  const out = await exec(conn, cmd);
  return { cmd, out, parsed: parseHeaderBlock(out.stdout) };
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host,
      port: 22,
      username,
      password,
      readyTimeout: 60000,
      keepaliveInterval: 10000,
    });
  });

  const checks = [];
  let failed = false;

  const basic = await exec(conn, "docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'");
  checks.push({ name: 'containers_running', pass: basic.stdout.includes('awesomeiwb-backend Up') && basic.stdout.includes('1Panel-openresty-zpMY Up'), detail: basic.stdout + basic.stderr });

  const auth = await fetchHeaders(conn, 'https://aiwb.smart-teach.cn/api/auth/me');
  checks.push({
    name: 'auth_no_store',
    pass: auth.parsed.statusLine.includes('401') && hasValue(auth.parsed.headers, 'cache-control', 'private, no-store') && hasValue(auth.parsed.headers, 'vary', 'cookie, authorization'),
    detail: auth.out.stdout + auth.out.stderr,
  });

  const feedback = await fetchHeaders(conn, 'https://aiwb.smart-teach.cn/api/feedback');
  checks.push({
    name: 'feedback_no_store',
    pass: feedback.parsed.statusLine.includes('200') && hasValue(feedback.parsed.headers, 'cache-control', 'private, no-store') && hasValue(feedback.parsed.headers, 'vary', 'cookie, authorization'),
    detail: feedback.out.stdout + feedback.out.stderr,
  });

  const stories = await fetchHeaders(conn, 'https://aiwb.smart-teach.cn/api/stories');
  const storiesEtag = (stories.parsed.headers['etag'] || [])[0] || '';
  const originStories = await exec(conn, 'curl -sSI -H "Host: aiwb.smart-teach.cn" http://127.0.0.1/api/stories');
  const originStoriesParsed = parseHeaderBlock(originStories.stdout);
  const originStoriesEtag = (originStoriesParsed.headers['etag'] || [])[0] || '';
  checks.push({
    name: 'stories_cache_etag',
    pass: stories.parsed.statusLine.includes('200') && hasValue(stories.parsed.headers, 'cache-control', 'max-age=30') && Boolean(storiesEtag),
    detail: stories.out.stdout + stories.out.stderr,
  });

  const projects = await fetchHeaders(conn, 'https://aiwb.smart-teach.cn/api/projects');
  checks.push({
    name: 'projects_cache_etag',
    pass: projects.parsed.statusLine.includes('200') && hasValue(projects.parsed.headers, 'cache-control', 'max-age=60') && hasValue(projects.parsed.headers, 'etag', 'W/"'),
    detail: projects.out.stdout + projects.out.stderr,
  });

  checks.push({
    name: 'stories_origin_etag_present',
    pass: Boolean(originStoriesEtag),
    detail: originStories.stdout + originStories.stderr,
  });

  if (storiesEtag && originStoriesEtag) {
    const ifNone = await exec(conn, `curl -sSI -H 'If-None-Match: ${storiesEtag}' https://aiwb.smart-teach.cn/api/stories`);
    const ifNoneParsed = parseHeaderBlock(ifNone.stdout);
    const externalRevalidateOk = ifNoneParsed.statusLine.includes('304') ||
      (ifNoneParsed.statusLine.includes('200') && hasValue(ifNoneParsed.headers, 'etag', storiesEtag));
    checks.push({
      name: 'stories_revalidate_external',
      pass: externalRevalidateOk,
      detail: ifNone.stdout + ifNone.stderr,
    });

    const originIfNone = await exec(
      conn,
      `curl -sSI -H 'Host: aiwb.smart-teach.cn' -H 'If-None-Match: ${originStoriesEtag}' http://127.0.0.1/api/stories`
    );
    checks.push({
      name: 'stories_304_origin',
      pass: originIfNone.stdout.includes('304 Not Modified'),
      detail: originIfNone.stdout + originIfNone.stderr,
    });
  } else {
    checks.push({
      name: 'stories_revalidate_external',
      pass: false,
      detail: 'No ETag from stories response',
    });
    checks.push({
      name: 'stories_304_origin',
      pass: false,
      detail: 'No ETag from stories response',
    });
  }

  const payloadStories = await exec(conn, 'curl -sS https://aiwb.smart-teach.cn/api/stories | head -c 400');
  checks.push({
    name: 'stories_payload',
    pass: payloadStories.stdout.trim().startsWith('['),
    detail: payloadStories.stdout + payloadStories.stderr,
  });

  const payloadProjects = await exec(conn, 'curl -sS https://aiwb.smart-teach.cn/api/projects | head -c 400');
  checks.push({
    name: 'projects_payload',
    pass: payloadProjects.stdout.trim().startsWith('{"categories":'),
    detail: payloadProjects.stdout + payloadProjects.stderr,
  });

  console.log('=== CHECK RESULTS ===');
  for (const c of checks) {
    if (!c.pass) failed = true;
    console.log(`\n[${c.pass ? 'PASS' : 'FAIL'}] ${c.name}`);
    console.log(c.detail);
  }

  conn.end();
  if (failed) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
