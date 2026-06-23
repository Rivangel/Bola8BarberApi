import { env } from '../config/env';

/**
 * Utilidades de fecha/hora para el bot. Trabajamos con dos representaciones:
 *  - `fecha`: un Date a medianoche UTC que representa un día de calendario.
 *  - hora: cadena "HH:MM" (24h).
 *
 * Toda la lógica de "hoy" / "pasado" usa la zona horaria configurada (TZ),
 * por defecto America/Mexico_City.
 */

const DIAS_SEMANA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Convierte "HH:MM" a minutos desde medianoche. */
export function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/** Convierte minutos desde medianoche a "HH:MM". */
export function minutosAHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Suma minutos a una hora "HH:MM" y devuelve "HH:MM". */
export function sumarMinutos(hora: string, minutos: number): string {
  return minutosAHora(horaAMinutos(hora) + minutos);
}

/**
 * Parsea una fecha en formato DD/MM/YYYY.
 * Devuelve un Date a medianoche UTC o `null` si el formato/valor es inválido.
 */
export function parsearFecha(texto: string): Date | null {
  const limpio = texto.trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(limpio);
  if (!match) return null;

  const dia = Number(match[1]);
  const mes = Number(match[2]);
  const anio = Number(match[3]);

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  // Validar que la fecha "exista" (p.ej. rechazar 31/02/2026).
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null;
  }
  return fecha;
}

/** Devuelve el año/mes/día actuales en la zona horaria configurada. */
function hoyEnTZ(): { anio: number; mes: number; dia: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [anio, mes, dia] = fmt.format(new Date()).split('-').map(Number);
  return { anio, mes, dia };
}

/** True si la fecha (día de calendario) es anterior a hoy en la zona horaria local. */
export function esFechaPasada(fecha: Date): boolean {
  const { anio, mes, dia } = hoyEnTZ();
  const hoyUTC = Date.UTC(anio, mes - 1, dia);
  return fecha.getTime() < hoyUTC;
}

/** True si la fecha es exactamente hoy (en la zona horaria local). */
export function esHoy(fecha: Date): boolean {
  const { anio, mes, dia } = hoyEnTZ();
  return fecha.getTime() === Date.UTC(anio, mes - 1, dia);
}

/** Formatea una fecha como "lunes 22 de junio de 2026". */
export function formatearFechaLegible(fecha: Date): string {
  const diaSemana = DIAS_SEMANA[fecha.getUTCDay()];
  const dia = fecha.getUTCDate();
  const mes = MESES[fecha.getUTCMonth()];
  const anio = fecha.getUTCFullYear();
  return `${diaSemana} ${dia} de ${mes} de ${anio}`;
}

/** Formatea una fecha como "DD/MM/YYYY". */
export function formatearFechaCorta(fecha: Date): string {
  const dia = String(fecha.getUTCDate()).padStart(2, '0');
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const anio = fecha.getUTCFullYear();
  return `${dia}/${mes}/${anio}`;
}

/**
 * Combina un día de calendario (Date UTC) y una hora "HH:MM" interpretada en la
 * zona horaria local, devolviendo el instante absoluto (Date) correspondiente.
 * Útil para comparar contra "ahora" en los recordatorios.
 */
export function instanteDeCita(fecha: Date, hora: string): Date {
  const [h, m] = hora.split(':').map(Number);
  // Construimos una fecha "ingenua" en UTC con la hora local deseada y luego
  // ajustamos por el desfase de la zona horaria en ese instante.
  const ingenuoUTC = Date.UTC(
    fecha.getUTCFullYear(),
    fecha.getUTCMonth(),
    fecha.getUTCDate(),
    h,
    m,
  );
  const desfaseMin = desfaseTZminutos(new Date(ingenuoUTC));
  return new Date(ingenuoUTC - desfaseMin * 60_000);
}

/**
 * Calcula el desfase (en minutos) de la zona horaria configurada respecto a UTC
 * para un instante dado. Positivo al este de UTC, negativo al oeste.
 */
function desfaseTZminutos(fecha: Date): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: env.timezone,
    timeZoneName: 'shortOffset',
  });
  const parte = fmt.formatToParts(fecha).find((p) => p.type === 'timeZoneName');
  if (!parte) return 0;
  // Ejemplos: "GMT-6", "GMT-5:30"
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(parte.value);
  if (!m) return 0;
  const signo = m[1] === '-' ? -1 : 1;
  const horas = Number(m[2]);
  const mins = m[3] ? Number(m[3]) : 0;
  return signo * (horas * 60 + mins);
}

/** Devuelve el día de calendario (Date UTC a medianoche) de hoy. */
export function fechaHoy(): Date {
  const { anio, mes, dia } = hoyEnTZ();
  return new Date(Date.UTC(anio, mes - 1, dia));
}

/** Devuelve el día de calendario de mañana. */
export function fechaManiana(): Date {
  const hoy = fechaHoy();
  return new Date(hoy.getTime() + 24 * 60 * 60 * 1000);
}
