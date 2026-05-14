FROM node:22-alpine AS build

WORKDIR /app

ARG APP_BUILD_SHA=unknown
ARG APP_BUILD_TIMESTAMP=unknown

COPY package.json package-lock.json ./
COPY angular.json ./
COPY tsconfig.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

RUN npm ci
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ARG APP_BUILD_SHA=unknown
ARG APP_BUILD_TIMESTAMP=unknown

ENV NODE_ENV=production
ENV PORT=4310
ENV FIRST_SLICE_OPERATOR_AUTH_REQUIRED=true
ENV APP_BUILD_SHA=${APP_BUILD_SHA}
ENV APP_BUILD_TIMESTAMP=${APP_BUILD_TIMESTAMP}

LABEL org.opencontainers.image.revision="${APP_BUILD_SHA}"
LABEL org.opencontainers.image.created="${APP_BUILD_TIMESTAMP}"

COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/packages/domain/dist ./packages/domain/dist
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/application/dist ./packages/application/dist
COPY --from=build /app/packages/memory-store/dist ./packages/memory-store/dist
COPY --from=build /app/packages/file-store/dist ./packages/file-store/dist
COPY --from=build /app/packages/sqlite-store/dist ./packages/sqlite-store/dist
COPY --from=build /app/packages/postgres-store/dist ./packages/postgres-store/dist

RUN npm ci --omit=dev && chown -R node:node /app

USER node

EXPOSE 4310

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=10 \
  CMD wget -qO- http://127.0.0.1:4310/readyz >/dev/null || exit 1

CMD ["node", "apps/api/dist/apps/api/src/index.js"]
