# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# deps: install the lockfile's exact dependency tree (including devDeps, which
# the build needs for Tailwind/Turbopack). Kept separate so this layer is only
# rebuilt when package.json or package-lock.json changes.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# builder: compile the Next.js app. `output: "standalone"` in next.config.mjs
# makes next build emit .next/standalone with a minimal server + traced deps.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# runner: only Node, ffmpeg and the build output. No npm, no source, no devDeps.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

# server.js reads PORT and HOSTNAME. Binding 0.0.0.0 is required so the port
# published with `docker run -p` is actually reachable.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# The app spawns `ffmpeg` by name (lib/ffmpeg.js), so it must live in this same
# image. Without it the app still runs, but downloads are video-only.
RUN apk add --no-cache ffmpeg

# Run as a non-root user. 1001 avoids clashing with the image's built-in node
# user (1000).
RUN addgroup -S -g 1001 nodejs \
 && adduser -S -D -H -u 1001 -G nodejs nextjs

# --chown matters: Next writes to .next/cache at runtime, so the app directory
# must be writable by this user.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Not included in standalone by default: without this the page loads unstyled
# and /_next/static/* returns 404.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# No curl/wget in the slim image, so probe with Node's built-in fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form: node becomes PID 1 and receives SIGTERM directly, which lets Next
# finish in-flight download streams on `docker stop`.
CMD ["node", "server.js"]
