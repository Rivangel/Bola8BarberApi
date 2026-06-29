-- ─────────────────────────────────────────────────────────────
-- Esquema de base de datos — Bola 8 Barbería
-- PostgreSQL 15
--
-- Este archivo es una referencia legible del esquema (DDL). La fuente de
-- verdad sigue siendo Prisma: el esquema se define en `schema.prisma` y se
-- aplica con las migraciones de `migrations/` (`prisma migrate deploy`).
-- Útil para inspeccionar la estructura o recrearla con `psql` en un entorno
-- sin Prisma:
--
--   psql "$DATABASE_URL" -f src/prisma/schema.sql
-- ─────────────────────────────────────────────────────────────

-- Estados posibles de una cita.
CREATE TYPE "EstadoCita" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'COMPLETADA');

-- ── Clientes ──────────────────────────────────────────────────
-- Se identifican de forma única por su teléfono.
CREATE TABLE "clientes" (
    "id"        SERIAL       NOT NULL,
    "nombre"    TEXT         NOT NULL,
    "telefono"  TEXT         NOT NULL,
    "notas"     TEXT,                  -- preferencias / notas del barbero (opcional)
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "clientes_telefono_key" ON "clientes" ("telefono");

-- ── Barberos ──────────────────────────────────────────────────
CREATE TABLE "barberos" (
    "id"     SERIAL  NOT NULL,
    "nombre" TEXT    NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "barberos_pkey" PRIMARY KEY ("id")
);

-- ── Servicios ─────────────────────────────────────────────────
-- Servicio ofrecido (corte, barba, etc.) con su duración y precio.
CREATE TABLE "servicios" (
    "id"              SERIAL        NOT NULL,
    "nombre"          TEXT          NOT NULL,
    "duracionMinutos" INTEGER       NOT NULL,
    "precio"          DECIMAL(10,2) NOT NULL,

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id")
);

-- ── Citas ─────────────────────────────────────────────────────
-- `fecha` guarda el día; `horaInicio`/`horaFin` el rango "HH:MM".
CREATE TABLE "citas" (
    "id"         SERIAL       NOT NULL,
    "clienteId"  INTEGER      NOT NULL,
    "barberoId"  INTEGER      NOT NULL,
    "servicioId" INTEGER      NOT NULL,
    "fecha"      DATE         NOT NULL,
    "horaInicio" TEXT         NOT NULL,
    "horaFin"    TEXT         NOT NULL,
    "estado"     "EstadoCita" NOT NULL DEFAULT 'PENDIENTE',
    "creadaEn"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "citas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "citas_fecha_barberoId_idx" ON "citas" ("fecha", "barberoId");
CREATE INDEX "citas_estado_idx" ON "citas" ("estado");

-- ── Conversaciones (máquina de estados del bot de WhatsApp) ───
-- Estado de la conversación por teléfono.
CREATE TABLE "conversaciones" (
    "id"            SERIAL       NOT NULL,
    "telefono"      TEXT         NOT NULL,
    "estado"        TEXT         NOT NULL DEFAULT 'INICIO',
    "datosTemp"     JSONB        NOT NULL DEFAULT '{}',
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversaciones_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "conversaciones_telefono_key" ON "conversaciones" ("telefono");

-- ── Claves foráneas ───────────────────────────────────────────
ALTER TABLE "citas"
    ADD CONSTRAINT "citas_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "citas"
    ADD CONSTRAINT "citas_barberoId_fkey"
    FOREIGN KEY ("barberoId") REFERENCES "barberos" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "citas"
    ADD CONSTRAINT "citas_servicioId_fkey"
    FOREIGN KEY ("servicioId") REFERENCES "servicios" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
