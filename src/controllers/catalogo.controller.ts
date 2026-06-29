import { Request, Response } from 'express';
import prisma from '../prisma/client';

/**
 * Controladores REST de catálogo (datos de apoyo para la app de administración):
 * servicios y barberos. Son de solo lectura; el bot ya los consume internamente.
 */

/** GET /api/servicios — lista los servicios ofrecidos. */
export async function getServicios(_req: Request, res: Response): Promise<void> {
  try {
    const servicios = await prisma.servicio.findMany({ orderBy: { id: 'asc' } });
    res.json(servicios);
  } catch (error) {
    console.error('❌ Error en getServicios:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

/** GET /api/barberos — lista los barberos activos. */
export async function getBarberos(_req: Request, res: Response): Promise<void> {
  try {
    const barberos = await prisma.barbero.findMany({
      where: { activo: true },
      orderBy: { id: 'asc' },
    });
    res.json(barberos);
  } catch (error) {
    console.error('❌ Error en getBarberos:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
