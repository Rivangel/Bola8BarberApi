#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# tunnel.sh — Expone el servidor local (puerto 3000) con ngrok y
# muestra la URL pública lista para registrar el webhook en Meta.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

PORT=3000
VERIFY_TOKEN="bola8secret123"

# --- Verificar que ngrok esté instalado ------------------------------------
if ! command -v ngrok >/dev/null 2>&1; then
  echo "❌ ngrok no está instalado. Instálalo con: npm install -g ngrok"
  exit 1
fi

# --- Iniciar ngrok en segundo plano ----------------------------------------
echo "🚀 Iniciando ngrok en el puerto ${PORT}..."
ngrok http "$PORT" >/dev/null 2>&1 &
NGROK_PID=$!

# Asegurar que ngrok se detenga si se cierra este script.
trap 'kill "$NGROK_PID" 2>/dev/null || true' EXIT

# --- Esperar a que ngrok inicialice ----------------------------------------
sleep 2

# --- Obtener la URL pública desde la API local de ngrok --------------------
PUBLIC_URL=""
for i in $(seq 1 10); do
  PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels \
    | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const t=JSON.parse(d).tunnels||[];const h=t.find(x=>x.public_url&&x.public_url.startsWith("https"))||t[0];process.stdout.write(h?h.public_url:"")}catch(e){process.stdout.write("")}})')
  if [ -n "$PUBLIC_URL" ]; then
    break
  fi
  sleep 1
done

if [ -z "$PUBLIC_URL" ]; then
  echo "❌ No se pudo obtener la URL pública de ngrok (¿está corriendo en :4040?)."
  exit 1
fi

# --- Mostrar la URL del webhook --------------------------------------------
echo ""
echo "=========================================="
echo "🚀 Webhook URL para Meta:"
echo "${PUBLIC_URL}/webhook"
echo ""
echo "Verify Token: ${VERIFY_TOKEN}"
echo "=========================================="
echo ""
echo "(ngrok sigue corriendo. Pulsa Ctrl+C para detenerlo.)"

# Mantener el script vivo mientras ngrok corre.
wait "$NGROK_PID"
