import { Request, Response } from 'express';
import {
  crearCita,
  listarCitasPorFecha,
  actualizarCita,
  cancelarCita,
  ErrorDeNegocio,
} from '../services/citas.service';
import { obtenerOCrear, buscarPorTelefono } from '../services/clientes.service';
import { parsearFecha, sumarMinutos } from '../utils/dates';
import { EstadoCita } from '@prisma/client';
import prisma from '../prisma/client';

/**
 * Controladores REST para /api/citas.
 * La lógica de dominio vive en los servicios; aquí solo validamos entrada,
 * traducimos a/desde HTTP y manejamos errores.
 */

/** Maneja errores de forma uniforme. */
function manejarError(res: Response, error: unknown): void {
  if (error instanceof ErrorDeNegocio) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error('❌ Error en citas.controller:', error);
  res.status(500).json({ error: 'Error interno del servidor.' });
}

/**
 * POST /api/citas
 * Crea una cita manualmente. Acepta `clienteId` o (`telefono` + `nombre`).
 * Body: { clienteId?, telefono?, nombre?, barberoId, servicioId, fecha: "DD/MM/YYYY", horaInicio: "HH:MM" }
 */
export async function postCita(req: Request, res: Response): Promise<void> {
  try {
    const { clienteId, telefono, nombre, barberoId, servicioId, fecha, horaInicio, estado } =
      req.body ?? {};

    if (!barberoId || !servicioId || !fecha || !horaInicio) {
      res
        .status(400)
        .json({ error: 'Faltan campos: barberoId, servicioId, fecha (DD/MM/YYYY) y horaInicio.' });
      return;
    }

    const fechaDate = parsearFecha(String(fecha));
    if (!fechaDate) {
      res.status(400).json({ error: 'Formato de fecha inválido. Use DD/MM/YYYY.' });
      return;
    }

    // Resolver el cliente: por ID o por teléfono+nombre.
    let resolvedClienteId = clienteId ? Number(clienteId) : undefined;
    if (!resolvedClienteId) {
      if (!telefono || !nombre) {
        res.status(400).json({ error: 'Proporcione clienteId, o bien telefono y nombre.' });
        return;
      }
      const cliente = await obtenerOCrear(String(telefono), String(nombre));
      resolvedClienteId = cliente.id;
    }

    const servicio = await prisma.servicio.findUnique({ where: { id: Number(servicioId) } });
    if (!servicio) {
      res.status(400).json({ error: 'El servicio no existe.' });
      return;
    }

    const horaFin = sumarMinutos(String(horaInicio), servicio.duracionMinutos);

    const cita = await crearCita({
      clienteId: resolvedClienteId,
      barberoId: Number(barberoId),
      servicioId: Number(servicioId),
      fecha: fechaDate,
      horaInicio: String(horaInicio),
      horaFin,
      estado: estado && estado in EstadoCita ? (estado as EstadoCita) : EstadoCita.CONFIRMADA,
    });

    res.status(201).json(cita);
  } catch (error) {
    manejarError(res, error);
  }
}

/**
 * GET /api/citas?fecha=YYYY-MM-DD
 * Lista las citas de un día.
 */
export async function getCitasPorFecha(req: Request, res: Response): Promise<void> {
  try {
    const fechaParam = req.query.fecha;
    if (!fechaParam || typeof fechaParam !== 'string') {
      res.status(400).json({ error: 'Indique el parámetro de consulta fecha=YYYY-MM-DD.' });
      return;
    }

    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaParam);
    if (!m) {
      res.status(400).json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD.' });
      return;
    }
    const fecha = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));

    const citas = await listarCitasPorFecha(fecha);
    res.json(citas);
  } catch (error) {
    manejarError(res, error);
  }
}

/**
 * PUT /api/citas/:id
 * Actualiza una cita: reagendar (fecha "DD/MM/YYYY", horaInicio, barberoId) o cambiar estado.
 */
export async function putCita(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }

    const { fecha, horaInicio, barberoId, estado } = req.body ?? {};
    const cambios: Record<string, unknown> = {};

    if (fecha !== undefined) {
      const fechaDate = parsearFecha(String(fecha));
      if (!fechaDate) {
        res.status(400).json({ error: 'Formato de fecha inválido. Use DD/MM/YYYY.' });
        return;
      }
      cambios.fecha = fechaDate;
    }

    if (barberoId !== undefined) cambios.barberoId = Number(barberoId);

    if (estado !== undefined) {
      if (!(estado in EstadoCita)) {
        res
          .status(400)
          .json({ error: 'Estado inválido. Use PENDIENTE, CONFIRMADA, CANCELADA o COMPLETADA.' });
        return;
      }
      cambios.estado = estado as EstadoCita;
    }

    // Si cambia la hora, recalculamos horaFin según la duración del servicio.
    if (horaInicio !== undefined) {
      const cita = await prisma.cita.findUnique({
        where: { id },
        include: { servicio: true },
      });
      if (!cita) {
        res.status(404).json({ error: 'La cita no existe.' });
        return;
      }
      cambios.horaInicio = String(horaInicio);
      cambios.horaFin = sumarMinutos(String(horaInicio), cita.servicio.duracionMinutos);
    }

    const actualizada = await actualizarCita(id, cambios);
    res.json(actualizada);
  } catch (error) {
    manejarError(res, error);
  }
}

/**
 * DELETE /api/citas/:id
 * Cancela una cita (estado = CANCELADA).
 */
export async function deleteCita(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    const cita = await cancelarCita(id);
    res.json({ mensaje: 'Cita cancelada.', cita });
  } catch (error) {
    manejarError(res, error);
  }
}
