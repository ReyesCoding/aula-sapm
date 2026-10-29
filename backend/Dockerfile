# syntax=docker/dockerfile:1

# ======================================================================
# Etapa 1: build — instala TODO (incluye devDependencies), genera el
# cliente de Prisma, compila TypeScript, y al final recorta las
# devDependencies del node_modules ya usado (no las vuelve a instalar).
# ======================================================================
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# Importante: usar "npm prune" acá (en vez de un "npm ci --omit=dev" nuevo
# en la etapa de runtime) para no arriesgar que una reinstalación limpia de
# @prisma/client pise el cliente ya generado para este schema — prune solo
# borra las devDependencies del node_modules existente, no reinstala nada.
RUN npm prune --omit=dev

# ======================================================================
# Etapa 2: runtime — imagen final, sin devDependencies ni código fuente TS.
# ======================================================================
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package*.json ./

# Carpeta de archivos subidos (ver middlewares/upload.middleware.ts). Se monta
# como volumen en docker-compose.yml para que sobreviva a rebuilds/redeploys.
RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["node", "dist/src/server.js"]
