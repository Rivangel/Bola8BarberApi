import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';

/**
 * Middleware de verificación de firma de Meta (cabecera x-hub-signature-256).
 *
 * Meta firma el cuerpo crudo de cada webhook con HMAC-SHA256 usando el App Secret.
 * Validamos esa firma para asegurar que la petición provenga realmente de Meta.
 *
 * Requiere que el cuerpo crudo esté disponible en `req.rawBody`
 * (lo capturamos con el `verify` de express.json en index.ts).
 *
 * Si no hay App Secret configurado (entorno de desarrollo), se omite la
 * verificación con una advertencia.
 */
export function verifySignature(req: Request, res: Response, next: NextFunction): void {
  if (!env.whatsappAppSecret) {
    console.warn('⚠️  WHATSAPP_APP_SECRET no configurado: se omite la verificación de firma.');
    next();
    return;
  }

  const firma = req.header('x-hub-signature-256');
  if (!firma) {
    res.status(401).json({ error: 'Falta la firma.' });
    return;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    console.error('❌ No se capturó el cuerpo crudo para verificar la firma.');
    res.status(400).json({ error: 'Cuerpo no verificable.' });
    return;
  }

  const esperado =
    'sha256=' + crypto.createHmac('sha256', env.whatsappAppSecret).update(rawBody).digest('hex');

  // Comparación en tiempo constante para evitar ataques de temporización.
  const firmaBuf = Buffer.from(firma);
  const esperadoBuf = Buffer.from(esperado);
  if (firmaBuf.length !== esperadoBuf.length || !crypto.timingSafeEqual(firmaBuf, esperadoBuf)) {
    res.status(401).json({ error: 'Firma inválida.' });
    return;
  }

  next();
}
