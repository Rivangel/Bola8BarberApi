#!/bin/sh
# ─────────────────────────────────────────────────────────────
# Entrypoint de la API. Antes de arrancar el servidor:
#   1. Aplica las migraciones de Prisma (la BD ya está "healthy" por compose).
#   2. Ejecuta el seed (idempotente).
# Luego lanza el comando recibido (CMD), p. ej. `npm run dev`.
# ─────────────────────────────────────────────────────────────
set -e

echo "📦 Aplicando migraciones de Prisma..."
npx prisma migrate deploy

echo "🌱 Ejecutando seed (idempotente)..."
npx prisma db seed || echo "⚠️  El seed falló o los datos ya existían; se continúa."

echo "🚀 Iniciando la API..."
exec "$@"
