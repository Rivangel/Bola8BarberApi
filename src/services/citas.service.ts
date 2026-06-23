import { Prisma, EstadoCita } from '@prisma/client';
import prisma from '../prisma/client';
import { estaDisponible } from './availability.service';

/**
 * Lógica de dominio de citas, reutilizada por la API REST y por el bot.
 */

export interface CrearCitaInput {
  clienteId: number;
  barberoId: number;
  servicioId: number;
  fecha: Date; // día de calendario (medianoche UTC)
  horaInicio: string; // "HH:MM"
  horaFin: string; // "HH:MM"
  estado?: EstadoCita;
}

/** Incluye relaciones útiles para mostrar la cita completa. */
const CON_RELACIONES = {
  cliente: true,
  barbero: true,
  servicio: true,
} satisfies Prisma.CitaInclude;

export type CitaCompleta = Prisma.CitaGetPayload<{ include: typeof CON_RELACIONES }>;

/** Crea una cita validando que el horario siga disponible. */
export async function crearCita(input: CrearCitaInput): Promise<CitaCompleta> {
  const servicio = await prisma.servicio.findUnique({ where: { id: input.servicioId } });
  if (!servicio) {
    throw new ErrorDeNegocio('El servicio indicado no existe.');
  }

  const libre = await estaDisponible(
    input.fecha,
    input.barberoId,
    input.horaInicio,
    servicio.duracionMinutos,
  );
  if (!libre) {
    throw new ErrorDeNegocio('El horario seleccionado ya no está disponible.');
  }

  return prisma.cita.create({
    data: {
      clienteId: input.clienteId,
      barberoId: input.barberoId,
      servicioId: input.servicioId,
      fecha: input.fecha,
      horaInicio: input.horaInicio,
      horaFin: input.horaFin,
      estado: input.estado ?? EstadoCita.CONFIRMADA,
    },
    include: CON_RELACIONES,
  });
}

/** Lista las citas de un día concreto, ordenadas por hora. */
export async function listarCitasPorFecha(fecha: Date): Promise<CitaCompleta[]> {
  return prisma.cita.findMany({
    where: { fecha },
    include: CON_RELACIONES,
    orderBy: [{ horaInicio: 'asc' }],
  });
}

/** Obtiene una cita por ID (o null). */
export async function obtenerCita(id: number): Promise<CitaCompleta | null> {
  return prisma.cita.findUnique({ where: { id }, include: CON_RELACIONES });
}

export interface ActualizarCitaInput {
  fecha?: Date;
  horaInicio?: string;
  horaFin?: string;
  barberoId?: number;
  estado?: EstadoCita;
}

/** Actualiza una cita (reagendar o cambiar estado). */
export async function actualizarCita(
  id: number,
  cambios: ActualizarCitaInput,
): Promise<CitaCompleta> {
  const cita = await prisma.cita.findUnique({ where: { id }, include: { servicio: true } });
  if (!cita) {
    throw new ErrorDeNegocio('La cita no existe.', 404);
  }

  // Si se reagenda (cambia fecha/hora/barbero), validar disponibilidad.
  const reagenda =
    cambios.fecha !== undefined ||
    cambios.horaInicio !== undefined ||
    cambios.barberoId !== undefined;

  if (reagenda) {
    const fecha = cambios.fecha ?? cita.fecha;
    const barberoId = cambios.barberoId ?? cita.barberoId;
    const horaInicio = cambios.horaInicio ?? cita.horaInicio;
    const libre = await estaDisponible(fecha, barberoId, horaInicio, cita.servicio.duracionMinutos);
    if (!libre) {
      throw new ErrorDeNegocio('El nuevo horario no está disponible.');
    }
  }

  return prisma.cita.update({
    where: { id },
    data: cambios,
    include: CON_RELACIONES,
  });
}

/** Cancela una cita (estado = CANCELADA). Devuelve la cita actualizada. */
export async function cancelarCita(id: number): Promise<CitaCompleta> {
  const cita = await prisma.cita.findUnique({ where: { id } });
  if (!cita) {
    throw new ErrorDeNegocio('La cita no existe.', 404);
  }
  return prisma.cita.update({
    where: { id },
    data: { estado: EstadoCita.CANCELADA },
    include: CON_RELACIONES,
  });
}

/** Lista las próximas citas activas de un cliente por teléfono. */
export async function citasProximasPorTelefono(telefono: string): Promise<CitaCompleta[]> {
  const cliente = await prisma.cliente.findUnique({ where: { telefono } });
  if (!cliente) return [];

  return prisma.cita.findMany({
    where: {
      clienteId: cliente.id,
      estado: { in: [EstadoCita.PENDIENTE, EstadoCita.CONFIRMADA] },
      fecha: { gte: hoyUTC() },
    },
    include: CON_RELACIONES,
    orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
  });
}

/** Historial completo de citas de un cliente por teléfono (más recientes primero). */
export async function historialPorTelefono(telefono: string): Promise<CitaCompleta[]> {
  const cliente = await prisma.cliente.findUnique({ where: { telefono } });
  if (!cliente) return [];

  return prisma.cita.findMany({
    where: { clienteId: cliente.id },
    include: CON_RELACIONES,
    orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
  });
}

/** Devuelve hoy a medianoche UTC para comparar días de calendario. */
function hoyUTC(): Date {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
}

/**
 * Error de negocio con código HTTP sugerido. Permite a los controladores
 * responder con el status adecuado sin acoplar la lógica de dominio a Express.
 */
export class ErrorDeNegocio extends Error {
  status: number;
  constructor(mensaje: string, status = 400) {
    super(mensaje);
    this.name = 'ErrorDeNegocio';
    this.status = status;
  }
}
