import express, { Request, Response, NextFunction } from 'express';
import { env } from './src/config/env';
import prisma from './src/prisma/client';
import webhookRoutes from './src/routes/webhook.routes';
import authRoutes from './src/routes/auth.routes';
import citasRoutes from './src/routes/citas.routes';
import clientesRoutes from './src/routes/clientes.routes';
import catalogoRoutes from './src/routes/catalogo.routes';
import cronRoutes from './src/routes/cron.routes';
import { requireAuth } from './src/middleware/requireAuth';
import { iniciarProgramador } from './src/jobs/reminders';

// En Vercel (serverless) no hay un proceso persistente: no se abre puerto con
// `listen()` ni se usa node-cron (los recordatorios los dispara Vercel Cron).
const enVercel = !!process.env.VERCEL;

/**
 * Punto de entrada de la aplicación — Bola 8 Barbería.
 * Configura Express, monta las rutas e inicia el planificador de recordatorios.
 */

const app = express();

// CORS permisivo: la app de administración (Expo) consume esta API desde otro
// origen. En producción conviene restringir `Access-Control-Allow-Origin`.
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Parser JSON que además guarda el cuerpo crudo (necesario para verificar la
// firma x-hub-signature-256 del webhook de Meta).
app.use(
  express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// Endpoint de salud.
app.get('/', (_req, res) => {
  res.json({ servicio: 'Bola 8 Barbería — Bot de WhatsApp', estado: 'ok' });
});

// Rutas del webhook de WhatsApp.
app.use('/', webhookRoutes);

// API REST de administración.
// Las rutas de auth (login) y de cron son públicas (cron usa su propio secreto);
// el resto requiere un JWT válido.
app.use('/api', authRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api', requireAuth);
app.use('/api', citasRoutes);
app.use('/api', clientesRoutes);
app.use('/api', catalogoRoutes);

// Manejador de rutas no encontradas.
app.use((_req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado.' });
});

// Manejador de errores global.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// Arranque tradicional (local / Docker). En Vercel se omite: la plataforma
// invoca el handler exportado por defecto y dispara los recordatorios vía cron.
if (!enVercel) {
  const server = app.listen(env.port, () => {
    console.log(`🚀 Servidor escuchando en el puerto ${env.port}`);
    console.log(`   Entorno: ${env.nodeEnv} · Zona horaria: ${env.timezone}`);
    iniciarProgramador();
  });

  // Cierre ordenado: desconectar Prisma y cerrar el servidor.
  const cerrar = async (senal: string): Promise<void> => {
    console.log(`\n${senal} recibido. Cerrando...`);
    server.close(async () => {
      await prisma.$disconnect();
      console.log('👋 Servidor cerrado correctamente.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => cerrar('SIGINT'));
  process.on('SIGTERM', () => cerrar('SIGTERM'));
}

export default app;
