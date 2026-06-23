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

function crearPrisma(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.databaseUrl });
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
