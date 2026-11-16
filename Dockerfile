# Imagem única: a API (Hono) servindo também o web compilado.
# Local:  docker build -t consultorio . && docker run --rm -p 127.0.0.1:8080:8080 -v consultorio-dados:/dados consultorio
# Nuvem (6.4): a mesma imagem no Cloud Run (o Firebase Hosting serve o web e repassa /api).
#
# SIGILO: publique só em 127.0.0.1 (como acima). O banco fica no volume /dados, nunca na imagem.

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# Dependências (better-sqlite3 compila nativo: precisa de python3, make e g++).
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# Web compilado.
FROM deps AS build
COPY . .
RUN pnpm --filter @consultorio/web build

FROM base AS final
ENV NODE_ENV=production \
    CONSULTORIO_CONTAINER=1 \
    HOST=0.0.0.0 \
    PORT=8080 \
    CONSULTORIO_DB=/dados/consultorio.db \
    CONSULTORIO_WEB=/app/apps/web/dist
COPY --from=build /app /app
RUN mkdir -p /dados && chown node:node /dados
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:8080/api/pronto').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# TypeScript direto via tsx por enquanto; a 6.2 troca por um bundle compilado.
CMD ["node", "--import", "tsx", "apps/api/src/index.ts"]
