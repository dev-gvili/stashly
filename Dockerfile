# Production image for the main app, deployed to Fly.io with fly.toml (repo root).
#
# Debian slim rather than Alpine: onnxruntime-node (via @huggingface/transformers)
# ships one linux build per arch, linked against glibc (needs GLIBC_2.28, no musl
# variant), so it can't load on Alpine. pnpm is pinned to the version CI uses so
# `--frozen-lockfile` reads the lockfile the same way.

FROM node:24-bookworm-slim AS base
RUN npm install -g pnpm@12.4.1
WORKDIR /app

# Toolchain for any native module that has to compile; build stages only.
FROM base AS toolchain
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# `postinstall` runs `prisma generate`, so the schema and its config have to be
# in place before the install, not after.
FROM toolchain AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

# Browser source maps to Vinktar, then off the image so the server never serves
# them. The upload stamps each chunk with a debug id, so it has to run before
# build/ is copied below. The key (vnk_sk_…, "cli" scope) arrives as a build
# secret and never lands in a layer; without it (CI, a local docker build) the
# upload is skipped and only the maps are removed.
#   fly deploy --build-secret VINKTAR_CLI_KEY=vnk_sk_… \
#     --build-arg VINKTAR_RELEASE=$(git rev-parse HEAD) \
#     --env VINKTAR_RELEASE=$(git rev-parse HEAD)
ARG VINKTAR_RELEASE
RUN --mount=type=secret,id=VINKTAR_CLI_KEY \
  if [ -s /run/secrets/VINKTAR_CLI_KEY ] && [ -n "$VINKTAR_RELEASE" ]; then \
    VINKTAR_CLI_KEY="$(cat /run/secrets/VINKTAR_CLI_KEY)" \
      npx -y @vinktarhq/cli@0.3.1 sourcemaps upload build/client \
      --release "$VINKTAR_RELEASE" --quiet; \
  else \
    echo "Vinktar source maps: no VINKTAR_CLI_KEY secret or VINKTAR_RELEASE, skipping upload"; \
  fi \
  && find build -name '*.map' -delete

FROM toolchain AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod

FROM node:24-bookworm-slim
# openssl: Prisma's schema engine (used by `prisma migrate deploy`) needs it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
# Non-root can't bind 80 (the server's default), so listen on 8080.
ENV PORT=8080

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
# prisma/ and prisma.config.ts serve fly.toml's release_command
# (`prisma migrate deploy`), which runs in this image.
COPY package.json server.js prisma.config.ts ./
COPY prisma ./prisma

USER node
EXPOSE 8080
CMD ["node", "server.js"]
