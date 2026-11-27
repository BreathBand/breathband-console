# The production image: one service, the way Cloud Run will run it
# (planning/v1/04-infrastructure.md, decision 6). The API serves /api/* and the
# static export from out/, with the security headers nginx used to add, on
# $PORT (Cloud Run sets it; 8080 here by default).
#
#   docker build -t breathband-console .
#   docker run --rm -p 8080:8080 -e AUTH_SECRET=... -e SMTP_HOST=... breathband-console
#   docker compose --profile full up --build      the same image with Mailpit and migrations
#   npm run docker:smoke                          builds, runs and checks it
#
# Nothing secret goes into the image: AUTH_SECRET, SMTP and database settings
# come from the environment at run time (.env* is in .dockerignore).

FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* values are inlined into the static build, so they are build
# args. The app and the API share an origin, so the http adapter's base URL
# is empty (same origin).
ARG NEXT_PUBLIC_BACKEND=http
ARG NEXT_PUBLIC_API_BASE_URL=
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
# The static export (out/), then the API compiled by esbuild with its native
# libSQL binding (build/server/; scripts/build-server.mjs). No tsx at run time.
RUN npm run build && npm run build:server

FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    TURSO_DATABASE_URL=file:/app/data/breathband.db \
    STORAGE_DIR=/app/data/blobs
COPY --from=build /app/build/server ./build/server
COPY --from=build /app/server/db/migrations ./server/db/migrations
COPY --from=build /app/out ./out
# The code stays root-owned and read-only to the app; only /app/data (the file
# database and blobs) is writable. Mount a volume there to keep it.
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 8080
# `node build/server/migrate.mjs` applies the migrations (the compose migrate
# service; later a Cloud Run job).
CMD ["node", "--enable-source-maps", "build/server/main.mjs"]
