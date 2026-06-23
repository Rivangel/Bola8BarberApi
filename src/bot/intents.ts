/**
 * Detección de intenciones por palabras clave en el mensaje del usuario.
 */

export enum Intencion {
  AGENDAR = 'AGENDAR',
  CANCELAR = 'CANCELAR',
  REAGENDAR = 'REAGENDAR',
  MIS_CITAS = 'MIS_CITAS',
  MENU = 'MENU',
  DESCONOCIDO = 'DESCONOCIDO',
}

/** Normaliza texto: minúsculas y sin acentos, para comparar palabras clave. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // elimina marcas diacríticas (acentos)
    .trim();
}

/** Detecta la intención principal del mensaje. */
export function detectarIntencion(texto: string): Intencion {
  const t = normalizar(texto);

  if (/\bmis (citas|turnos)\b/.test(t)) return Intencion.MIS_CITAS;
  if (/\b(reagendar|reagenda|cambiar|cambia)\b/.test(t)) return Intencion.REAGENDAR;
  if (/\b(cancelar|cancela)\b/.test(t)) return Intencion.CANCELAR;
  if (/\b(agendar|agenda|cita|citas|turno|turnos|reservar|reserva)\b/.test(t))
    return Intencion.AGENDAR;
  if (/\b(hola|buenas|buenos dias|buenas tardes|buenas noches|menu|inicio|hey|que onda)\b/.test(t))
    return Intencion.MENU;

  return Intencion.DESCONOCIDO;
}

/** Palabras para abortar el flujo en curso y volver al menú. */
export function esComandoSalir(texto: string): boolean {
  const t = normalizar(texto);
  return /\b(salir|cancelar todo|menu|inicio|empezar de nuevo)\b/.test(t);
}
