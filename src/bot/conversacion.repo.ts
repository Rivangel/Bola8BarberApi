import prisma from '../prisma/client';
import { Estado, DatosTemp } from './estados';

/**
 * Acceso a la tabla Conversacion: carga, actualización y reinicio del
 * estado de conversación de cada teléfono.
 */

export interface EstadoConversacion {
  estado: Estado;
  datos: DatosTemp;
}

/** Carga (o crea) la conversación de un teléfono. */
export async function cargar(telefono: string): Promise<EstadoConversacion> {
  const conv = await prisma.conversacion.upsert({
    where: { telefono },
    update: {},
    create: { telefono, estado: Estado.INICIO, datosTemp: {} },
  });

  return {
    estado: (conv.estado as Estado) ?? Estado.INICIO,
    datos: (conv.datosTemp as DatosTemp) ?? {},
  };
}

/** Guarda el nuevo estado y datos temporales. */
export async function guardar(
  telefono: string,
  estado: Estado,
  datos: DatosTemp = {},
): Promise<void> {
  await prisma.conversacion.upsert({
    where: { telefono },
    update: { estado, datosTemp: datos as object },
    create: { telefono, estado, datosTemp: datos as object },
  });
}

/** Reinicia la conversación al estado INICIO y limpia los datos temporales. */
export async function reiniciar(telefono: string): Promise<void> {
  await guardar(telefono, Estado.INICIO, {});
}
