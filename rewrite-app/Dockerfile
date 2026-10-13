FROM node:22-alpine AS workspace-manifests

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/application/package.json ./packages/application/package.json
COPY packages/memory-store/package.json ./packages/memory-store/package.json
COPY packages/file-store/package.json ./packages/file-store/package.json
COPY packages/sqlite-store/package.json ./packages/sqlite-store/package.json
COPY packages/postgres-store/package.json ./packages/postgres-store/package.json

FROM workspace-manifests AS build

RUN npm ci

ARG APP_BUILD_SHA=unknown
ARG APP_BUILD_TIMESTAMP=unknown

COPY angular.json ./
COPY tsconfig.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

ENV FIRST_SLICE_XML_SCHEMA_CACHE=/app/xml-schemas
# Bound build-time memory and workers without changing runtime Node options.
RUN NODE_OPTIONS="--max-old-space-size=1536" NG_BUILD_MAX_WORKERS=2 npm run build

FROM workspace-manifests AS runtime

ENV NODE_ENV=production
RUN npm ci --omit=dev && chown -R node:node /app

ARG APP_BUILD_SHA=unknown
ARG APP_BUILD_TIMESTAMP=unknown

ENV PORT=4310
ENV FIRST_SLICE_OPERATOR_AUTH_REQUIRED=true
ENV FIRST_SLICE_HSTS_ENABLED=false
ENV FIRST_SLICE_ADMIN_LOGIN_MAX_FAILURES=5
ENV FIRST_SLICE_ADMIN_LOGIN_FAILURE_WINDOW_MS=1800000
ENV FIRST_SLICE_ADMIN_PASSWORD_MIN_LENGTH=8
ENV FIRST_SLICE_ADMIN_PASSWORD_PATTERN=^.*$
ENV FIRST_SLICE_PROOF_OF_WORK_SCOPES=""
ENV FIRST_SLICE_PROOF_OF_WORK_MAX_NUMBER=1000000
ENV FIRST_SLICE_PROOF_OF_WORK_TTL_MS=120000
ENV FIRST_SLICE_PARTICIPANT_LOGIN_MAX_FAILURES=5
ENV FIRST_SLICE_PARTICIPANT_LOGIN_FAILURE_WINDOW_MS=1800000
ENV FIRST_SLICE_XML_SCHEMA_PROFILE=original-19
ENV FIRST_SLICE_XML_SCHEMA_CACHE=/app/xml-schemas
ENV FIRST_SLICE_XML_SCHEMA_DOWNLOAD=false
ENV APP_BUILD_SHA=${APP_BUILD_SHA}
ENV APP_BUILD_TIMESTAMP=${APP_BUILD_TIMESTAMP}

LABEL org.opencontainers.image.revision="${APP_BUILD_SHA}"
LABEL org.opencontainers.image.created="${APP_BUILD_TIMESTAMP}"

COPY --chown=node:node tsconfig.json tsconfig.base.json ./
COPY --chown=node:node apps ./apps
COPY --chown=node:node packages ./packages
COPY --chown=node:node scripts ./scripts
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/dist/apps/web ./dist/apps/web
COPY --from=build --chown=node:node /app/packages/domain/dist ./packages/domain/dist
COPY --from=build --chown=node:node /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build --chown=node:node /app/packages/application/dist ./packages/application/dist
COPY --from=build --chown=node:node /app/packages/memory-store/dist ./packages/memory-store/dist
COPY --from=build --chown=node:node /app/packages/file-store/dist ./packages/file-store/dist
COPY --from=build --chown=node:node /app/packages/sqlite-store/dist ./packages/sqlite-store/dist
COPY --from=build --chown=node:node /app/packages/postgres-store/dist ./packages/postgres-store/dist
COPY --from=build --chown=node:node /app/xml-schemas ./xml-schemas

RUN RUNTIME_PREFLIGHT_SKIP_STORAGE_DOCTOR=true \
  RUNTIME_PREFLIGHT_REQUIRE_BUILD_METADATA=false \
  node ./scripts/runtime-preflight.mjs

USER node

EXPOSE 4310

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=10 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4310}/readyz" >/dev/null || exit 1

CMD ["node", "apps/api/dist/apps/api/src/index.js"]
