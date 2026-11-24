FROM node:24.22.3-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit

COPY astro.config.mjs eslint.config.mjs ./
COPY src/ src/
COPY tests/ tests/
RUN npm run lint && npm test && npm run build && npm prune --omit=dev --no-audit

FROM node:24.22.3-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY scripts/migrate.mjs scripts/migrate.mjs
COPY db/schema.sql db/schema.sql

USER node
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
