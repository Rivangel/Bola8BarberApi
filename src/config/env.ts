import dotenv from 'dotenv';

dotenv.config();

/**
 * Lee y valida una variable de entorno obligatoria.
 * Lanza un error claro al arrancar si falta, en lugar de fallar silenciosamente.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : fallback;
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  whatsappToken: required('WHATSAPP_TOKEN'),
  whatsappPhoneNumberId: required('WHATSAPP_PHONE_NUMBER_ID'),
  whatsappVerifyToken: required('WHATSAPP_VERIFY_TOKEN'),
  // El App Secret es opcional: si no se define, se omite la verificación de firma
  // (útil en desarrollo local). En producción debe configurarse.
  whatsappAppSecret: optional('WHATSAPP_APP_SECRET', ''),
  port: parseInt(optional('PORT', '3000'), 10),
  timezone: optional('TZ', 'America/Mexico_City'),
  nodeEnv: optional('NODE_ENV', 'development'),
  // URL base de la Graph API de Meta
  graphApiVersion: optional('GRAPH_API_VERSION', 'v21.0'),
  // Secreto para firmar/verificar los JWT del login del panel.
  jwtSecret: required('JWT_SECRET'),
  // Vigencia del token (formato de `jsonwebtoken`, p. ej. "7d", "12h").
  jwtExpire: optional('JWT_EXPIRE', '7d'),
  // Secreto que protege los endpoints de cron (recordatorios) cuando se ejecutan
  // en Vercel Cron en lugar de node-cron. Vercel envía `Authorization: Bearer <CRON_SECRET>`.
  cronSecret: optional('CRON_SECRET', ''),
};

export type Env = typeof env;
