/**
 * Validadores y saneamiento de entrada.
 */

// Caracteres de control ASCII (incluye \x7F DEL) que removemos del texto.
// eslint-disable-next-line no-control-regex
const CARACTERES_CONTROL = /[\x00-\x1F\x7F]/g;

/**
 * Sanea texto proveniente de WhatsApp:
 *  - elimina caracteres de control
 *  - colapsa espacios múltiples
 *  - recorta espacios
 *  - limita la longitud para evitar abusos
 */
export function sanitizarTexto(texto: unknown, maxLen = 500): string {
  if (typeof texto !== 'string') return '';
  return texto
    .replace(CARACTERES_CONTROL, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/** Valida un nombre de persona: 2–80 caracteres, contiene al menos una letra. */
export function esNombreValido(nombre: string): boolean {
  const limpio = nombre.trim();
  return limpio.length >= 2 && limpio.length <= 80 && /[a-zA-ZÀ-ÿ]/.test(limpio);
}

/**
 * Normaliza un número de teléfono a solo dígitos.
 * WhatsApp Cloud API entrega los números ya en formato E.164 sin "+".
 */
export function normalizarTelefono(telefono: unknown): string {
  if (typeof telefono !== 'string') return '';
  return telefono.replace(/\D/g, '');
}

/** Valida formato básico de teléfono (10 a 15 dígitos). */
export function esTelefonoValido(telefono: string): boolean {
  const digitos = normalizarTelefono(telefono);
  return digitos.length >= 10 && digitos.length <= 15;
}

/** Interpreta una respuesta afirmativa en español. */
export function esAfirmacion(texto: string): boolean {
  const t = texto.trim().toLowerCase();
  return ['si', 'sí', 'sip', 'claro', 'confirmar', 'confirmo', 'ok', 'okay', 'va', 'dale'].includes(
    t,
  );
}

/** Interpreta una respuesta negativa en español. */
export function esNegacion(texto: string): boolean {
  const t = texto.trim().toLowerCase();
  return ['no', 'nel', 'nop', 'cancela', 'cancelar', 'nope'].includes(t);
}

/**
 * Extrae el primer número entero de un texto (p.ej. "opción 2" -> 2).
 * Devuelve null si no hay número.
 */
export function extraerNumero(texto: string): number | null {
  const m = /\d+/.exec(texto);
  return m ? parseInt(m[0], 10) : null;
}
