import { Request, Response } from 'express';
import { login, obtenerUsuarioPorId } from '../services/auth.service';
import { ErrorDeNegocio } from '../services/citas.service';

/**
 * Controladores REST para /api/auth.
 * Validan la entrada, delegan en el servicio de auth y traducen errores a HTTP.
 */

/** Maneja errores de forma uniforme (mismo patrón que citas.controller). */
function manejarError(res: Response, error: unknown): void {
  if (error instanceof ErrorDeNegocio) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error('❌ Error en auth.controller:', error);
  res.status(500).json({ error: 'Error interno del servidor.' });
}

// Validación básica de formato de email.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/login
 * Body: { email, password } → { token, usuario }
 */
export async function postLogin(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body ?? {};

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      res.status(400).json({ error: 'Indica email y contraseña.' });
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      res.status(400).json({ error: 'El email no tiene un formato válido.' });
      return;
    }

    const resultado = await login(email, password);
    res.json(resultado);
  } catch (error) {
    manejarError(res, error);
  }
}

/**
 * GET /api/auth/me
 * Devuelve el usuario autenticado (requiere requireAuth).
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    if (!req.usuario) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }
    const usuario = await obtenerUsuarioPorId(req.usuario.sub);
    res.json(usuario);
  } catch (error) {
    manejarError(res, error);
  }
}
