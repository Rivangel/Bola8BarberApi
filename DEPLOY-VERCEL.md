# Despliegue en Vercel — API Bola 8 Barbería

Esta API (Express + Prisma 7 + PostgreSQL) está preparada para desplegarse como
**Serverless Functions** en Vercel. Esta guía resume qué se cambió y los pasos
para ponerla en producción.

## Qué se adaptó para serverless

| Archivo | Cambio |
| --- | --- |
| `api/index.ts` | Entry de Vercel: reexporta la app Express como handler. |
| `index.ts` | `app.listen()` y `node-cron` ahora solo corren **fuera** de Vercel (`if (!process.env.VERCEL)`); en Vercel se usa el handler exportado. Se montan las rutas de cron. |
| `src/routes/cron.routes.ts` | Endpoints `/api/cron/recordatorios-24h` y `/api/cron/recordatorios-2h`, protegidos por `CRON_SECRET`. Sustituyen a node-cron. |
| `vercel.json` | Rewrite de todas las rutas a `/api`, build de Prisma y definición de los cron jobs. |
| `src/prisma/schema.prisma` | `binaryTargets` incluye `rhel-openssl-3.0.x` (runtime de Vercel). |
| `package.json` | `engines.node = 22.x` y script `vercel-build: prisma generate`. |
| `.env.example` | Nueva variable `CRON_SECRET`. |

> **Local / Docker no cambia:** sin la variable `VERCEL`, el servidor sigue
> arrancando con `listen()` y node-cron exactamente como antes.

## Requisitos previos

1. **Base de datos PostgreSQL gestionada** (Neon, Supabase o Vercel Postgres).
   No uses el Postgres de Docker. Prefiere la cadena con **pooling** (pgbouncer)
   para serverless, p. ej. la `DATABASE_URL` "pooled" que dan Neon/Supabase.
2. Repo en GitHub ya conectado: `github.com/Rivangel/Bola8BarberApi`.

## Pasos

1. **Migraciones**: ejecútalas una vez contra la BD de producción desde tu máquina
   (Vercel no corre `migrate deploy` dentro de la función). Usa el **Session pooler**
   (`:5432`). El motor de migraciones acepta `sslmode=require`; el seed usa el cliente
   en runtime, así que verifica el certificado con la CA:
   ```bash
   # Migrar (motor de Prisma; TLS sin verificación estricta de CA)
   DATABASE_URL="postgresql://...@...pooler.supabase.com:5432/postgres?sslmode=require" \
     npx prisma migrate deploy

   # Sembrar datos + usuario admin (cliente runtime; verifica con la CA)
   DATABASE_CA_CERT_FILE="certs/supabase-ca.pem" \
   DATABASE_URL="postgresql://...@...pooler.supabase.com:5432/postgres" \
     npx prisma db seed
   ```

2. **Importar el proyecto en Vercel** (New Project → el repo). Root Directory:
   la carpeta de la API si el repo la contiene en subcarpeta; aquí es la raíz.

3. **Variables de entorno** en Vercel (Project → Settings → Environment Variables):
   - `DATABASE_URL` → la del **Transaction pooler** (`:6543`), **sin** `?sslmode=...`
     (el SSL lo gestiona el código vía CA).
   - `DATABASE_CA_CERT` → contenido PEM de `certs/supabase-ca.pem` (pega el bloque
     completo `-----BEGIN/END CERTIFICATE-----`). Verifica el certificado de Supabase.
   - `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`
   - `JWT_SECRET`, `JWT_EXPIRE`
   - `TZ=America/Mexico_City`, `GRAPH_API_VERSION=v21.0`
   - `CRON_SECRET` → genera con `openssl rand -hex 32`
   - `NODE_ENV=production`

4. **Deploy**. Vercel ejecuta `npx prisma generate` (buildCommand) y publica la función.

5. **Actualizar el webhook de Meta** y la app móvil para que apunten a la nueva
   URL `https://<tu-proyecto>.vercel.app` (webhook: `…/webhook`).

## Notas y limitaciones importantes

- **Cron en UTC**: Vercel programa en UTC. `0 15 * * *` = **09:00 en Ciudad de
  México** (UTC-6, sin horario de verano). El de cada hora (`0 * * * *`) es
  independiente de la zona.
- **Plan Vercel**: el plan *Hobby* limita los cron jobs a **una ejecución diaria**.
  El recordatorio de 2h (cada hora) requiere plan **Pro**. Si te quedas en Hobby,
  deja solo el cron de 24h o usa un disparador externo (GitHub Actions / cron-job.org)
  llamando a los endpoints con la cabecera `Authorization: Bearer $CRON_SECRET`.
- **Probar los crons manualmente**:
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" \
    https://<tu-proyecto>.vercel.app/api/cron/recordatorios-24h
  ```
- **Conexiones a la BD**: cada invocación puede abrir conexión; por eso es clave
  usar una BD con pooling. El cliente Prisma ya es singleton (`globalThis`).
- **Webhook (raw body)**: la verificación de firma de Meta usa el body crudo. Como
  toda la app Express va detrás de un único handler, el `express.json({ verify })`
  sigue funcionando sin que Vercel consuma el body antes.
- **Cold starts**: la primera petición tras inactividad será algo más lenta.
- **TLS verificado con CA**: Supabase firma su certificado con una CA privada
  (`Supabase Root 2021 CA`) que Node no trae de fábrica. Por eso el driver `pg` la
  necesita explícitamente vía `DATABASE_CA_CERT`/`DATABASE_CA_CERT_FILE` (ver
  `src/prisma/client.ts`). La CA pública está versionada en `certs/supabase-ca.pem`
  (válida hasta 2031). Sin SSL configurado (local/Docker) la conexión va sin TLS.
