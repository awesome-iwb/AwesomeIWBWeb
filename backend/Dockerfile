FROM oven/bun:1.3.13-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src/ src/
COPY stories/ stories/
COPY migrations/ migrations/

RUN mkdir -p /app/runtime/uploads /app/logs

EXPOSE 8081

CMD ["bun", "run", "src/index.ts"]
