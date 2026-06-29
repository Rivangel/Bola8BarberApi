import { Request, Response } from 'express';
import { listarClientes, actualizarCliente } from '../services/clientes.service';
import { historialPorTelefono } from '../services/citas.service';
import { esNombreValido, esTelefonoValido, normalizarTelefono } from '../utils/validators';

/** Controladores REST para /api/clientes. */

/** GET /api/clientes — lista todos los clientes. */
export async function getClientes(_req: Request, res: Response): Promise<void> {
  try {
    const clientes = await listarClientes();
    res.json(clientes);
  } catch (error) {
    console.error('❌ Error en getClientes:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

/**
 * PUT /api/clientes/:id — actualiza nombre, teléfono y/o notas de un cliente.
 * Body: { nombre?, telefono?, notas? }  (notas puede ser null para limpiarla)
 */
export async function putCliente(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }

    const { nombre, telefono, notas } = req.body ?? {};
    const cambios: { nombre?: string; telefono?: string; notas?: string | null } = {};

    if (nombre !== undefined) {
      if (!esNombreValido(String(nombre))) {
        res.status(400).json({ error: 'Nombre inválido.' });
        return;
      }
      cambios.nombre = String(nombre).trim();
    }

    if (telefono !== undefined) {
      if (!esTelefonoValido(String(telefono))) {
        res.status(400).json({ error: 'Teléfono inválido (debe tener 10 a 15 dígitos).' });
        return;
      }
      cambios.telefono = String(telefono).trim();
    }

    if (notas !== undefined) {
      cambios.notas = notas === null || notas === '' ? null : String(notas);
    }

    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: 'No se indicó ningún campo para actualizar.' });
      return;
    }

    const cliente = await actualizarCliente(id, cambios);
    if (!cliente) {
      res.status(404).json({ error: 'El cliente no existe.' });
      return;
    }
    res.json(cliente);
  } catch (error) {
    // Conflicto de teléfono único (Prisma P2002).
    if (error && typeof error === 'object' && (error as { code?: string }).code === 'P2002') {
      res.status(409).json({ error: 'Ya existe un cliente con ese teléfono.' });
      return;
    }
    console.error('❌ Error en putCliente:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

/** GET /api/clientes/:telefono/historial — historial de citas del cliente. */
export async function getHistorialCliente(req: Request, res: Response): Promise<void> {
  try {
    const telefono = normalizarTelefono(req.params.telefono);
    if (!telefono) {
      res.status(400).json({ error: 'Teléfono inválido.' });
      return;
    }
    const historial = await historialPorTelefono(telefono);
    res.json(historial);
  } catch (error) {
    console.error('❌ Error en getHistorialCliente:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
