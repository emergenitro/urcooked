FROM node:20-alpine AS deps

# better-sqlite3 needs build tools to compile native bindings
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# ---- runtime image ----
FROM node:20-alpine

WORKDIR /app

# Drop privileges - never run as root
RUN addgroup -S app && adduser -S app -G app

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY public ./public

# Persistent storage for sqlite. Railway: mount a volume here.
RUN mkdir -p /app/db && chown -R app:app /app

USER app

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_DIR=/app/db

EXPOSE 3000

# Healthcheck (Railway uses this if configured)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://localhost:3000/health || exit 1

CMD ["node", "src/index.js"]
