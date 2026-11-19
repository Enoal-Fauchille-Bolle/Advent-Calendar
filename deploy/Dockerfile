# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f deploy/Dockerfile .

FROM node:24-trixie-slim AS base
# pnpm is a native executable; the whole folder is copied because it bundles node-gyp.
COPY --from=ghcr.io/pnpm/pnpm:12.6.0 /opt/pnpm /opt/pnpm
RUN for bin in pnpm pn pnpx pnx; do ln -s "/opt/pnpm/$bin" "/usr/local/bin/$bin"; done
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Scripts are skipped: `prepare` installs Git hooks.
FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --store-dir /var/cache/pnpm --frozen-lockfile --ignore-scripts
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --store-dir /var/cache/pnpm --prod --frozen-lockfile --ignore-scripts

FROM node:24-trixie-slim
ENV ADVENT_HOST=0.0.0.0 \
    ADVENT_CONTENT_DIR=/content \
    ADVENT_STATE_DIR=/state
WORKDIR /app
# The application files stay owned by root, so the server cannot change them.
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY assets ./assets
# The only folder the server writes: push subscriptions and the days already sent.
RUN install -d -o node -g node /state
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
