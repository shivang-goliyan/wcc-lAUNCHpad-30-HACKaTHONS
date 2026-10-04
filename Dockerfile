# Nami Care — one image, two processes (web + worker). Node 22, pnpm.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/lib ./lib
COPY --from=build /app/worker ./worker
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/eval ./eval
COPY package.json next.config.ts tsconfig.json ./
EXPOSE 3000
CMD ["pnpm", "start"]
