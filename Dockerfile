# syntax=docker/dockerfile:1

FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build
RUN npm prune --omit=dev

FROM node:20-slim

ARG APP_VERSION=0.0.0
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./package.json

RUN mkdir -p /config

ENV PORT=8080 \
    OUTPUT_PATH=/data/timetree.ics \
    CRON_SCHEDULE="*/30 * * * *" \
    NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    GIT_SHA=${GIT_SHA} \
    BUILD_TIME=${BUILD_TIME}

LABEL org.opencontainers.image.title="timetree-live-ics" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_TIME}"

VOLUME ["/data", "/config"]
EXPOSE 8080

CMD ["node", "dist/index.js"]
