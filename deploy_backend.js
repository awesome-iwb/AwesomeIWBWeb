const { Client } = require("ssh2");
const conn = new Client();

const HOST = "210.16.165.251";
const USER = "root";
const PASS = "8EGZ4jf3vumREH";

function exec(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, opts, (err, stream) => {
      if (err) return reject(err);
      let stdout = "";
      let stderr = "";
      stream.on("data", (d) => { stdout += d.toString(); process.stdout.write(d.toString()); });
      stream.stderr.on("data", (d) => { stderr += d.toString(); process.stderr.write(d.toString()); });
      stream.on("close", (code) => resolve({ stdout, stderr, code }));
    });
  });
}

async function main() {
  console.log("=== Connecting to server ===");
  await new Promise((resolve, reject) => {
    conn.on("ready", resolve);
    conn.on("error", reject);
    conn.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 30000 });
  });
  console.log("Connected!\n");

  // ── Step 0: Read backend.env to get DATABASE_URL credentials ──
  console.log("=== Step 0: Reading /etc/awesomeiwb/backend.env ===");
  const envResult = await exec("cat /etc/awesomeiwb/backend.env");
  console.log(envResult.stdout);

  const dbUrlMatch = envResult.stdout.match(/DATABASE_URL\s*=\s*(.+)/);
  let actualDbUrl = "";
  if (dbUrlMatch) {
    actualDbUrl = dbUrlMatch[1].trim().replace(/['"]/g, "");
    console.log(`Found DATABASE_URL: ${actualDbUrl}`);
  } else {
    console.log("WARNING: Could not find DATABASE_URL in backend.env, will use placeholder");
  }

  // Parse the DATABASE_URL to extract password and construct the Docker-internal URL
  // Format: postgres://user:password@host:port/dbname
  let dockerDbUrl = "postgres://awesomeiwb:awesomeiwb@postgres:5432/awesomeiwb";
  if (actualDbUrl) {
    const urlMatch = actualDbUrl.match(/postgres:\/\/([^:]+):([^@]+)@[^:]+:(\d+)\/(.+)/);
    if (urlMatch) {
      const dbUser = urlMatch[1];
      const dbPass = urlMatch[2];
      const dbPort = urlMatch[3];
      const dbName = urlMatch[4];
      dockerDbUrl = `postgres://${dbUser}:${dbPass}@postgres:${dbPort}/${dbName}`;
      console.log(`Docker-internal DATABASE_URL will be: ${dockerDbUrl}`);
    }
  }

  // ── Step 1: Upload the Dockerfile ──
  console.log("\n=== Step 1: Creating Dockerfile ===");
  const dockerfile = `FROM oven/bun:1.3.13-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src/ src/
COPY stories/ stories/
COPY migrations/ migrations/

RUN mkdir -p /app/runtime/uploads /app/logs

EXPOSE 8081

CMD ["bun", "run", "src/index.ts"]`;

  await exec(`mkdir -p /opt/awesomeiwb/backend`);
  const dfResult = await exec(`cat > /opt/awesomeiwb/backend/Dockerfile << 'DOCKERFILE_EOF'\n${dockerfile}\nDOCKERFILE_EOF`);
  console.log("Dockerfile created.");
  const dfVerify = await exec("cat /opt/awesomeiwb/backend/Dockerfile");
  console.log("Dockerfile contents:\n" + dfVerify.stdout);

  // ── Step 2: Upload docker-compose.yml ──
  console.log("\n=== Step 2: Creating docker-compose.yml ===");
  const compose = `services:
  postgres:
    image: postgres:16-alpine
    container_name: awesomeiwb-pg
    restart: unless-stopped
    env_file:
      - .env
    environment:
      POSTGRES_DB: \${POSTGRES_DB}
      POSTGRES_USER: \${POSTGRES_USER}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - /var/lib/awesomeiwb-pg:/var/lib/postgresql/data
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 5s
      retries: 20

  backend:
    build:
      context: ../backend
      dockerfile: Dockerfile
    container_name: awesomeiwb-backend
    restart: unless-stopped
    env_file:
      - /etc/awesomeiwb/backend.env
    environment:
      HOST: "0.0.0.0"
      PORT: "8081"
      DATABASE_URL: ${dockerDbUrl}
    ports:
      - "127.0.0.1:8081:8081"
    volumes:
      - /opt/awesomeiwb/backend/stories:/app/stories
      - /opt/awesomeiwb/backend/runtime:/app/runtime
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:8081/ || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 15s`;

  await exec(`mkdir -p /opt/awesomeiwb/deploy`);
  const dcResult = await exec(`cat > /opt/awesomeiwb/deploy/docker-compose.yml << 'COMPOSE_EOF'\n${compose}\nCOMPOSE_EOF`);
  console.log("docker-compose.yml created.");
  const dcVerify = await exec("cat /opt/awesomeiwb/deploy/docker-compose.yml");
  console.log("docker-compose.yml contents:\n" + dcVerify.stdout);

  // ── Step 3: Stop existing systemd backend service ──
  console.log("\n=== Step 3: Stopping existing systemd backend service ===");
  const stopSvc = await exec("systemctl stop awesomeiwb-backend 2>&1; systemctl disable awesomeiwb-backend 2>&1");
  console.log(stopSvc.stdout + stopSvc.stderr);

  // ── Step 4: Stop existing Docker PostgreSQL container ──
  console.log("\n=== Step 4: Stopping existing Docker PostgreSQL container ===");
  const stopPg = await exec("docker stop awesomeiwb-pg 2>&1; docker rm awesomeiwb-pg 2>&1");
  console.log(stopPg.stdout + stopPg.stderr);

  // ── Step 5: Build and start containers ──
  console.log("\n=== Step 5: Building and starting containers ===");
  const buildResult = await exec("cd /opt/awesomeiwb/deploy && docker compose up -d --build 2>&1", { pty: true });
  console.log(buildResult.stdout + buildResult.stderr);

  console.log("\n=== Checking container status ===");
  const psResult = await exec("docker compose -f /opt/awesomeiwb/deploy/docker-compose.yml ps");
  console.log(psResult.stdout);

  console.log("\n=== Backend logs (last 30 lines) ===");
  const logsResult = await exec("docker compose -f /opt/awesomeiwb/deploy/docker-compose.yml logs backend --tail 30");
  console.log(logsResult.stdout);

  // ── Step 6: Verify the backend is working ──
  console.log("\n=== Step 6: Verifying the backend ===");
  await exec("sleep 5");

  console.log("--- Testing API directly ---");
  const curl1 = await exec("curl -s http://127.0.0.1:8081/api/projects/ICC-CE 2>&1 | head -c 200");
  console.log("Direct API response: " + curl1.stdout);

  console.log("--- Testing through nginx ---");
  const curl2 = await exec("curl -s http://127.0.0.1:8080/api/projects/ICC-CE 2>&1 | head -c 200");
  console.log("Nginx API response: " + curl2.stdout);

  console.log("--- Checking container health ---");
  const health1 = await exec("docker inspect awesomeiwb-backend --format='{{.State.Health.Status}}' 2>/dev/null || echo 'Health check not ready yet'");
  console.log("Backend health: " + health1.stdout.trim());
  const health2 = await exec("docker inspect awesomeiwb-pg --format='{{.State.Health.Status}}' 2>/dev/null || echo 'Health check not ready yet'");
  console.log("Postgres health: " + health2.stdout.trim());

  // ── Step 7: If build failed, try fallback ──
  const psCheck = await exec("docker compose -f /opt/awesomeiwb/deploy/docker-compose.yml ps --format json 2>&1");
  const backendRunning = psCheck.stdout.includes("running") || psCheck.stdout.includes("healthy");

  if (!backendRunning) {
    console.log("\n=== Step 7: Build may have failed, trying fallback ===");
    const fallback = await exec("cd /opt/awesomeiwb/backend && docker build --no-cache -t awesomeiwb-backend . 2>&1", { pty: true });
    console.log(fallback.stdout + fallback.stderr);

    console.log("\n=== Retrying compose up ===");
    const retry = await exec("cd /opt/awesomeiwb/deploy && docker compose up -d 2>&1");
    console.log(retry.stdout + retry.stderr);

    await exec("sleep 5");

    console.log("\n=== Re-checking status ===");
    const rePs = await exec("docker compose -f /opt/awesomeiwb/deploy/docker-compose.yml ps");
    console.log(rePs.stdout);

    const reLogs = await exec("docker compose -f /opt/awesomeiwb/deploy/docker-compose.yml logs backend --tail 30");
    console.log(reLogs.stdout);

    console.log("--- Re-testing API ---");
    const reCurl1 = await exec("curl -s http://127.0.0.1:8081/api/projects/ICC-CE 2>&1 | head -c 200");
    console.log("Direct API response: " + reCurl1.stdout);
    const reCurl2 = await exec("curl -s http://127.0.0.1:8080/api/projects/ICC-CE 2>&1 | head -c 200");
    console.log("Nginx API response: " + reCurl2.stdout);

    const reHealth1 = await exec("docker inspect awesomeiwb-backend --format='{{.State.Health.Status}}' 2>/dev/null || echo 'Health check not ready yet'");
    console.log("Backend health: " + reHealth1.stdout.trim());
    const reHealth2 = await exec("docker inspect awesomeiwb-pg --format='{{.State.Health.Status}}' 2>/dev/null || echo 'Health check not ready yet'");
    console.log("Postgres health: " + reHealth2.stdout.trim());
  }

  console.log("\n=== Deployment script complete ===");
  conn.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  conn.end();
  process.exit(1);
});
