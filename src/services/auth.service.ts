import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { Usuario } from '@prisma/client';
import prisma from '../prisma/client';
import { env } from '../config/env';
import { ErrorDeNegocio } from './citas.service';

/**
 * Lógica de autenticación del panel de administración.
 *
 * Los usuarios inician sesión con email + contraseña; devolvemos un JWT firmado
 * con `JWT_SECRET` que la app guarda y reenvía en la cabecera `Authorization`.
 */

/** Datos del usuario expuestos al cliente (nunca el passwordHash). */
export type UsuarioPublico = Omit<Usuario, 'passwordHash'>;

/** Payload que viaja dentro del JWT. */
export interface TokenPayload {
  sub: number;
  rol: Usuario['rol'];
}

/** Quita el passwordHash antes de devolver el usuario. */
function aPublico(usuario: Usuario): UsuarioPublico {
  const { passwordHash: _omit, ...resto } = usuario;
  return resto;
}

/**
 * Valida credenciales y devuelve `{ token, usuario }`.
 * Lanza `ErrorDeNegocio(401)` con un mensaje genérico si fallan, sin revelar
 * si el email existe o no.
 */
export async function login(
  email: string,
  password: string,
): Promise<{ token: string; usuario: UsuarioPublico }> {
  const emailNormalizado = email.trim().toLowerCase();
  const usuario = await prisma.usuario.findUnique({ where: { email: emailNormalizado } });

  // Comparamos el hash siempre (aunque no exista el usuario) para no filtrar
  // por tiempo de respuesta qué emails están registrados.
  const hashComparable = usuario?.passwordHash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const coincide = await bcrypt.compare(password, hashComparable);

  if (!usuario || !usuario.activo || !coincide) {
    throw new ErrorDeNegocio('Credenciales inválidas.', 401);
  }

  const payload: TokenPayload = { sub: usuario.id, rol: usuario.rol };
  const opciones: jwt.SignOptions = {
    expiresIn: env.jwtExpire as jwt.SignOptions['expiresIn'],
  };
  const token = jwt.sign(payload, env.jwtSecret, opciones);

  return { token, usuario: aPublico(usuario) };
}

/** Verifica un JWT y devuelve su payload; lanza `ErrorDeNegocio(401)` si es inválido. */
export function verificarToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, env.jwtSecret) as unknown as TokenPayload;
  } catch {
    throw new ErrorDeNegocio('Token inválido o expirado.', 401);
  }
}

/** Busca un usuario activo por id (para GET /auth/me). */
export async function obtenerUsuarioPorId(id: number): Promise<UsuarioPublico> {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario || !usuario.activo) {
    throw new ErrorDeNegocio('Usuario no encontrado.', 404);
  }
  return aPublico(usuario);
}
