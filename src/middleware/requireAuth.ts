import { Request, Response, NextFunction } from 'express';
import { verificarToken } from '../services/auth.service';
import type { TokenPayload } from '../services/auth.service';
import { ErrorDeNegocio } from '../services/citas.service';

/**
 * Middleware de autenticación por JWT.
 *
 * Lee la cabecera `Authorization: Bearer <token>`, la verifica con `JWT_SECRET`
 * y adjunta el payload decodificado en `req.usuario`. Si falta o es inválido,
 * responde 401.
 */

// Extendemos el tipo Request de Express para exponer el usuario autenticado.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const [esquema, token] = header.split(' ');

  if (esquema !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Falta el token de autenticación.' });
    return;
  }

  try {
    req.usuario = verificarToken(token);
    next();
  } catch (error) {
    if (error instanceof ErrorDeNegocio) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(401).json({ error: 'No autorizado.' });
  }
}
