# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────
# API REST + bot de WhatsApp — Bola 8 Barbería
# Imagen única (modo desarrollo): corre con ts-node y aplica
# migraciones + seed de Prisma al arrancar (ver docker-entrypoint.sh).
# ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim

# Prisma necesita OpenSSL para el motor de migraciones.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=development

# Instalar dependencias (incluye prisma y ts-node para migrar, sembrar y ejecutar).
COPY package*.json ./
RUN npm ci

# Copiar el resto del código.
COPY . .

# Asegurar permisos de ejecución del entrypoint.
RUN chmod +x docker-entrypoint.sh

# Generar el cliente de Prisma.
RUN npx prisma generate

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
