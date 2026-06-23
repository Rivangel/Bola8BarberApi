import { Request, Response } from 'express';
import { env } from '../config/env';
import { procesarMensaje } from '../bot/stateMachine';
import { enviarTexto, marcarComoLeido } from '../services/whatsapp.service';
import { normalizarTelefono } from '../utils/validators';

/**
 * Controlador del webhook de WhatsApp Cloud API.
 *  - GET  /webhook: handshake de verificación con Meta.
 *  - POST /webhook: recepción de mensajes entrantes.
 */

/**
 * GET /webhook
 * Meta envía hub.mode=subscribe, hub.verify_token y hub.challenge.
 * Si el token coincide, devolvemos el challenge en texto plano.
 */
export function verificarWebhook(req: Request, res: Response): void {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.whatsappVerifyToken) {
    console.log('✅ Webhook verificado por Meta.');
    res.status(200).send(challenge);
    return;
  }

  console.warn('⚠️  Verificación de webhook fallida (token no coincide).');
  res.sendStatus(403);
}

/**
 * POST /webhook
 * Procesa los mensajes entrantes. Responde 200 de inmediato (requisito de Meta)
 * y procesa el mensaje de forma asíncrona.
 */
export function recibirWebhook(req: Request, res: Response): void {
  // Siempre respondemos 200 rápido para que Meta no reintente.
  res.sendStatus(200);

  // El procesamiento se hace después de responder, con su propio manejo de errores.
  procesarPayload(req.body).catch((error) => {
    console.error('❌ Error procesando payload del webhook:', error);
  });
}

/**
 * Extrae los mensajes del payload y los despacha al bot.
 * Sanea defensivamente cada nivel del objeto por si el formato cambia.
 */
async function procesarPayload(payload: unknown): Promise<void> {
  if (!payload || typeof payload !== 'object') return;
  const body = payload as Record<string, any>;

  if (body.object !== 'whatsapp_business_account') return;

  const entradas = Array.isArray(body.entry) ? body.entry : [];
  for (const entrada of entradas) {
    const cambios = Array.isArray(entrada?.changes) ? entrada.changes : [];
    for (const cambio of cambios) {
      const value = cambio?.value;
      if (!value || cambio.field !== 'messages') continue;

      const mensajes = Array.isArray(value.messages) ? value.messages : [];
      for (const mensaje of mensajes) {
        await procesarMensajeEntrante(mensaje);
      }
    }
  }
}

/** Procesa un único mensaje entrante y envía las respuestas del bot. */
async function procesarMensajeEntrante(mensaje: any): Promise<void> {
  const telefono = normalizarTelefono(mensaje?.from);
  if (!telefono) return;

  // Marcamos como leído (no bloqueante).
  if (mensaje?.id) {
    marcarComoLeido(mensaje.id).catch(() => undefined);
  }

  // Extraemos el texto según el tipo de mensaje.
  let texto = '';
  if (mensaje?.type === 'text') {
    texto = mensaje?.text?.body ?? '';
  } else if (mensaje?.type === 'interactive') {
    // Soporte básico para respuestas de botones/listas si se usaran plantillas.
    texto =
      mensaje?.interactive?.button_reply?.title ??
      mensaje?.interactive?.list_reply?.title ??
      mensaje?.interactive?.button_reply?.id ??
      '';
  } else {
    // Tipos no soportados (imagen, audio, ubicación, etc.).
    await enviarTexto(
      telefono,
      '📩 Por ahora solo entiendo mensajes de *texto*. Escribe *menú* para ver las opciones. 🙂',
    );
    return;
  }

  const respuestas = await procesarMensaje(telefono, texto);
  for (const respuesta of respuestas) {
    await enviarTexto(telefono, respuesta);
  }
}
