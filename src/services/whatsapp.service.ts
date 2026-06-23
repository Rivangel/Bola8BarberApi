import axios, { AxiosError } from 'axios';
import { env } from '../config/env';

/**
 * Cliente de la WhatsApp Cloud API (Graph API de Meta).
 * Encapsula el envío de mensajes salientes.
 */

const BASE_URL = `https://graph.facebook.com/${env.graphApiVersion}/${env.whatsappPhoneNumberId}`;

const http = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${env.whatsappToken}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

/**
 * Envía un mensaje de texto simple a un número de WhatsApp.
 * @param telefono Número en formato E.164 sin "+" (como lo entrega Meta).
 * @param texto    Cuerpo del mensaje (máx. 4096 caracteres).
 */
export async function enviarTexto(telefono: string, texto: string): Promise<void> {
  const cuerpo = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: telefono,
    type: 'text',
    text: {
      preview_url: false,
      body: texto.slice(0, 4096),
    },
  };

  try {
    await http.post('/messages', cuerpo);
  } catch (error) {
    const ax = error as AxiosError;
    console.error(
      '❌ Error al enviar mensaje de WhatsApp:',
      ax.response?.status,
      JSON.stringify(ax.response?.data ?? ax.message),
    );
    // No relanzamos: un fallo de envío no debe tumbar el flujo del webhook.
  }
}

/**
 * Marca un mensaje entrante como leído (los dobles checks azules).
 * Es opcional pero mejora la experiencia del cliente.
 */
export async function marcarComoLeido(messageId: string): Promise<void> {
  try {
    await http.post('/messages', {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  } catch {
    // Silencioso: marcar como leído nunca debe interrumpir el flujo.
  }
}
