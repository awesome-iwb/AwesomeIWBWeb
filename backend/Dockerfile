FROM oven/bun:1.3.13-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src/ src/
COPY stories/ stories/
COPY migrations/ migrations/

RUN mkdir -p \
    /app/runtime/uploads \
    /app/runtime/media/objects \
    /app/runtime/media/derivatives \
    /app/runtime/media/staging \
    /app/logs \
  && chown -R bun:bun /app/runtime /app/logs

USER bun

EXPOSE 8081

CMD ["bun", "run", "src/index.ts"]
