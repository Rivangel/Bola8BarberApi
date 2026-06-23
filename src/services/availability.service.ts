import prisma from '../prisma/client';
import { horaAMinutos, sumarMinutos } from '../utils/dates';

/**
 * Lógica de disponibilidad de horarios.
 *
 * Jornada laboral: 09:00 a 19:00. Los slots se generan cada 30 minutos.
 * Un slot es válido si la cita completa (slot + duración del servicio) termina
 * a más tardar a las 19:00 y no se solapa con ninguna cita existente del barbero.
 */

export const APERTURA = '09:00';
export const CIERRE = '19:00';
export const PASO_MINUTOS = 30;

// Estados que ocupan la agenda del barbero.
const ESTADOS_OCUPAN: ('PENDIENTE' | 'CONFIRMADA')[] = ['PENDIENTE', 'CONFIRMADA'];

interface Rango {
  inicio: number; // minutos desde medianoche
  fin: number;
}

/** True si dos rangos [inicio, fin) se solapan. */
function seSolapan(a: Rango, b: Rango): boolean {
  return a.inicio < b.fin && b.inicio < a.fin;
}

/**
 * Devuelve los horarios disponibles ("HH:MM") para un barbero en una fecha,
 * considerando la duración del servicio.
 *
 * @param fecha           Día de calendario (Date a medianoche UTC).
 * @param barberoId       ID del barbero.
 * @param duracionMinutos Duración del servicio en minutos.
 */
export async function getHorariosDisponibles(
  fecha: Date,
  barberoId: number,
  duracionMinutos: number,
): Promise<string[]> {
  const citas = await prisma.cita.findMany({
    where: {
      barberoId,
      fecha,
      estado: { in: ESTADOS_OCUPAN },
    },
    select: { horaInicio: true, horaFin: true },
  });

  const ocupados: Rango[] = citas.map((c) => ({
    inicio: horaAMinutos(c.horaInicio),
    fin: horaAMinutos(c.horaFin),
  }));

  const apertura = horaAMinutos(APERTURA);
  const cierre = horaAMinutos(CIERRE);
  const disponibles: string[] = [];

  for (let t = apertura; t + duracionMinutos <= cierre; t += PASO_MINUTOS) {
    const candidato: Rango = { inicio: t, fin: t + duracionMinutos };
    const libre = !ocupados.some((o) => seSolapan(candidato, o));
    if (libre) {
      disponibles.push(sumarMinutos('00:00', t));
    }
  }

  return disponibles;
}

/**
 * Para "sin preferencia": devuelve la unión de horarios disponibles entre todos
 * los barberos activos (un horario está disponible si AL MENOS un barbero lo tiene).
 */
export async function getHorariosDisponiblesCualquiera(
  fecha: Date,
  duracionMinutos: number,
): Promise<string[]> {
  const barberos = await prisma.barbero.findMany({ where: { activo: true }, select: { id: true } });
  const conjunto = new Set<string>();

  for (const b of barberos) {
    const horarios = await getHorariosDisponibles(fecha, b.id, duracionMinutos);
    horarios.forEach((h) => conjunto.add(h));
  }

  return Array.from(conjunto).sort();
}

/**
 * Encuentra un barbero activo libre en una fecha/hora dada para "sin preferencia".
 * Devuelve el ID del barbero o null si ninguno está disponible.
 */
export async function getBarberoDisponible(
  fecha: Date,
  hora: string,
  duracionMinutos: number,
): Promise<number | null> {
  const barberos = await prisma.barbero.findMany({ where: { activo: true }, select: { id: true } });
  for (const b of barberos) {
    const horarios = await getHorariosDisponibles(fecha, b.id, duracionMinutos);
    if (horarios.includes(hora)) return b.id;
  }
  return null;
}

/**
 * Verifica que un barbero específico siga libre en el horario indicado.
 * Se usa como última comprobación antes de guardar para evitar dobles reservas.
 */
export async function estaDisponible(
  fecha: Date,
  barberoId: number,
  hora: string,
  duracionMinutos: number,
): Promise<boolean> {
  const horarios = await getHorariosDisponibles(fecha, barberoId, duracionMinutos);
  return horarios.includes(hora);
}
