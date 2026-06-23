import express, { Request, Response, NextFunction } from 'express';
import { env } from './src/config/env';
import prisma from './src/prisma/client';
import webhookRoutes from './src/routes/webhook.routes';
import citasRoutes from './src/routes/citas.routes';
import clientesRoutes from './src/routes/clientes.routes';
import { iniciarProgramador } from './src/jobs/reminders';

/**
 * Punto de entrada de la aplicación — Bola 8 Barbería.
 * Configura Express, monta las rutas e inicia el planificador de recordatorios.
 */

const app = express();

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
app.use('/api', citasRoutes);
app.use('/api', clientesRoutes);

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

const server = app.listen(env.port, () => {
  console.log(`🚀 Servidor escuchando en el puerto ${env.port}`);
  console.log(`   Entorno: ${env.nodeEnv} · Zona horaria: ${env.timezone}`);
  iniciarProgramador();
});

// Cierre ordenado: desconectar Prisma y cerrar el servidor.
async function cerrar(senal: string): Promise<void> {
  console.log(`\n${senal} recibido. Cerrando...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('👋 Servidor cerrado correctamente.');
    process.exit(0);
  });
}

process.on('SIGINT', () => cerrar('SIGINT'));
process.on('SIGTERM', () => cerrar('SIGTERM'));

export default app;
