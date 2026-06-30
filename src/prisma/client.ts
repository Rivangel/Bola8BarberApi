import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';

/**
 * Cliente Prisma compartido (singleton).
 *
 * Prisma 7 requiere un "driver adapter": aquí usamos `@prisma/adapter-pg`, que
 * se conecta a PostgreSQL mediante el driver `pg`. La URL viene de DATABASE_URL.
 *
 * El singleton evita crear múltiples pools de conexión, especialmente durante
 * el desarrollo con recarga en caliente.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Configuración TLS para el driver `pg`.
 *
 * En proveedores gestionados como Supabase el certificado lo firma una CA
 * privada que Node no tiene en su almacén de confianza. Para verificar la cadena
 * (en lugar de desactivar la verificación) se proporciona la CA de Supabase:
 *  - `DATABASE_CA_CERT`      → contenido PEM directo (recomendado en Vercel).
 *  - `DATABASE_CA_CERT_FILE` → ruta a un archivo PEM (cómodo en local).
 *
 * Si no se proporciona ninguna, no se usa SSL (caso local/Docker sin TLS), igual
 * que antes.
 */
function configurarSsl(): { ca: string; rejectUnauthorized: true } | undefined {
  const caInline = process.env.DATABASE_CA_CERT;
  const caPath = process.env.DATABASE_CA_CERT_FILE;

  let ca: string | undefined;
  if (caInline && caInline.trim() !== '') {
    // En Vercel el PEM puede llegar con saltos de línea escapados ("\n").
    ca = caInline.includes('-----BEGIN') ? caInline.replace(/\\n/g, '\n') : caInline;
  } else if (caPath && fs.existsSync(caPath)) {
    ca = fs.readFileSync(caPath, 'utf8');
  }

  if (!ca) return undefined;
  return { ca, rejectUnauthorized: true };
}

function crearPrisma(): PrismaClient {
  const ssl = configurarSsl();
  const adapter = new PrismaPg({ connectionString: env.databaseUrl, ...(ssl ? { ssl } : {}) });
  return new PrismaClient({
    adapter,
    log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? crearPrisma();

if (env.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
