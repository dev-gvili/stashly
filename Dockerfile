# Production image for the main app, deployed to Fly.io with ../fly.toml.
#
# Debian slim rather than Alpine: onnxruntime-node (via @huggingface/transformers)
# and webgpu ship glibc-only native binaries. pnpm is pinned to the version CI
# uses so `--frozen-lockfile` reads the lockfile the same way.

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
