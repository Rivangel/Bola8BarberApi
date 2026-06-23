import prisma from '../prisma/client';
import { Cliente } from '@prisma/client';

/** Lógica de dominio de clientes. */

/** Busca un cliente por teléfono. */
export async function buscarPorTelefono(telefono: string): Promise<Cliente | null> {
  return prisma.cliente.findUnique({ where: { telefono } });
}

/**
 * Devuelve el cliente existente o lo crea con el nombre dado.
 * Usado por el bot cuando un número nuevo agenda por primera vez.
 */
export async function obtenerOCrear(telefono: string, nombre: string): Promise<Cliente> {
  return prisma.cliente.upsert({
    where: { telefono },
    update: {}, // no sobrescribimos el nombre existente
    create: { telefono, nombre },
  });
}

/** Lista todos los clientes registrados. */
export async function listarClientes(): Promise<Cliente[]> {
  return prisma.cliente.findMany({ orderBy: { nombre: 'asc' } });
}
