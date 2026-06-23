import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Configuración de Prisma 7.
 *
 * A partir de Prisma 7 la URL de conexión ya no vive en schema.prisma:
 *  - Para los comandos de migración/introspección se define aquí en `datasource`.
 *  - Para el cliente en tiempo de ejecución se usa un driver adapter (ver src/prisma/client.ts).
 */
export default defineConfig({
  schema: 'src/prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'ts-node src/prisma/seed.ts',
  },
});
