#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# setup.sh — Levanta la base de datos de Bola 8 Barbería de cero.
#   1. Inicia el contenedor de PostgreSQL (Docker).
#   2. Espera a que PostgreSQL esté listo (máx. 30 s).
#   3. Aplica las migraciones de Prisma.
#   4. Ejecuta el seed (datos iniciales).
#   5. Confirma con un mensaje de éxito.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# Ubicarse en la raíz del proyecto (carpeta padre de scripts/).
cd "$(dirname "$0")/.."

# --- 0. Verificar que Docker esté instalado --------------------------------
if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker no está instalado."
  echo "   Instálalo desde: https://docs.docker.com/get-docker/"
  exit 1
fi

# Elegir el comando de compose disponible (plugin v2 o binario clásico).
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "❌ Docker Compose no está disponible."
  echo "   Instálalo desde: https://docs.docker.com/get-docker/"
  exit 1
fi

# --- 1. Iniciar el contenedor ----------------------------------------------
echo "🐳 Iniciando contenedor de PostgreSQL..."
$COMPOSE up -d

# --- 2. Esperar a que PostgreSQL esté listo (máx. 30 s) --------------------
echo "⏳ Esperando a que PostgreSQL acepte conexiones..."
READY=0
for i in $(seq 1 30); do
  if docker exec bola8_postgres pg_isready -U bola8user -d barberbola8 >/dev/null 2>&1; then
    READY=1
    echo "✅ PostgreSQL listo (tras ${i}s)."
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "❌ PostgreSQL no estuvo listo tras 30 segundos."
  exit 1
fi

# --- 3. Aplicar migraciones de Prisma --------------------------------------
echo "📦 Aplicando migraciones de Prisma..."
npx prisma migrate dev --name init

# --- 4. Ejecutar el seed ----------------------------------------------------
echo "🌱 Ejecutando seed..."
npx ts-node src/prisma/seed.ts

# --- 5. Confirmación --------------------------------------------------------
echo "✅ Base de datos lista"
