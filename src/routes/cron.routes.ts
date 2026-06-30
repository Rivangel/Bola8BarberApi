import { Router, Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { enviarRecordatorios24h, enviarRecordatorios2h } from '../jobs/reminders';

/**
 * Endpoints de recordatorios para entornos serverless (Vercel).
 *
 * En Vercel no existe un proceso de larga duración, así que `node-cron` no se
 * ejecuta. En su lugar, Vercel Cron invoca estos endpoints según el calendario
 * definido en `vercel.json`. Vercel añade automáticamente la cabecera
 * `Authorization: Bearer <CRON_SECRET>` cuando la variable `CRON_SECRET` está
 * configurada en el proyecto, de modo que sólo el planificador puede dispararlos.
 */

const router = Router();

// Verifica el secreto de cron. Si no hay `CRON_SECRET` configurado, se rechaza
// por seguridad (estos endpoints disparan envíos reales de WhatsApp).
function requireCronSecret(req: Request, res: Response, next: NextFunction): void {
  if (!env.cronSecret) {
    res.status(503).json({ error: 'CRON_SECRET no configurado en el servidor.' });
    return;
  }
  const header = req.header('authorization') ?? '';
  if (header !== `Bearer ${env.cronSecret}`) {
    res.status(401).json({ error: 'No autorizado.' });
    return;
  }
  next();
}

router.get('/recordatorios-24h', requireCronSecret, async (_req, res) => {
  try {
    await enviarRecordatorios24h();
    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Error en recordatorios 24h:', error);
    res.status(500).json({ error: 'Error al enviar recordatorios 24h.' });
  }
});

router.get('/recordatorios-2h', requireCronSecret, async (_req, res) => {
  try {
    await enviarRecordatorios2h();
    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Error en recordatorios 2h:', error);
    res.status(500).json({ error: 'Error al enviar recordatorios 2h.' });
  }
});

export default router;
