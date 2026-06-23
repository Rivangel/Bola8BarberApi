import { Request, Response } from 'express';
import { listarClientes } from '../services/clientes.service';
import { historialPorTelefono } from '../services/citas.service';
import { normalizarTelefono } from '../utils/validators';

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
