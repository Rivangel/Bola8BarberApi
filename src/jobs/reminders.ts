import cron from 'node-cron';
import { EstadoCita } from '@prisma/client';
import prisma from '../prisma/client';
import { env } from '../config/env';
import { enviarTexto } from '../services/whatsapp.service';
import * as T from '../services/templates.service';
import { fechaManiana, fechaHoy, instanteDeCita } from '../utils/dates';

/**
 * Planificador de recordatorios con node-cron.
 *
 *  - Todos los días a las 09:00: recordatorio 24h para las citas de mañana.
 *  - Cada hora en punto: recordatorio 2h para las citas que comienzan dentro
 *    de ~2 horas.
 *
 * Para el recordatorio de 2h usamos una ventana de 60 minutos centrada en las
 * 2 horas (entre +90 y +150 min). Como el job corre cada hora, cada cita cae
 * exactamente en una ejecución, evitando recordatorios duplicados sin necesidad
 * de columnas extra en la base de datos.
 */

const CON_RELACIONES = {
  cliente: true,
  barbero: true,
  servicio: true,
} as const;

/** Construye los datos para las plantillas a partir de una cita con relaciones. */
function aResumen(cita: {
  fecha: Date;
  horaInicio: string;
  horaFin: string;
  servicio: { nombre: string; precio: unknown };
  barbero: { nombre: string };
  cliente: { nombre: string };
}): T.ResumenCitaData {
  return {
    servicio: cita.servicio.nombre,
    barbero: cita.barbero.nombre,
    precio: cita.servicio.precio,
    fecha: cita.fecha,
    horaInicio: cita.horaInicio,
    horaFin: cita.horaFin,
    cliente: cita.cliente.nombre,
  };
}

/** Envía los recordatorios de 24 horas (citas confirmadas de mañana). */
export async function enviarRecordatorios24h(): Promise<void> {
  const manana = fechaManiana();
  const citas = await prisma.cita.findMany({
    where: { fecha: manana, estado: EstadoCita.CONFIRMADA },
    include: CON_RELACIONES,
  });

  console.log(`📨 Recordatorios 24h: ${citas.length} cita(s) para mañana.`);
  for (const cita of citas) {
    const telefono = cita.cliente.telefono;
    await enviarTexto(telefono, T.recordatorio24h(aResumen(cita)));
  }
}

/** Envía los recordatorios de 2 horas (citas confirmadas de hoy próximas a comenzar). */
export async function enviarRecordatorios2h(): Promise<void> {
  const hoy = fechaHoy();
  const citas = await prisma.cita.findMany({
    where: { fecha: hoy, estado: EstadoCita.CONFIRMADA },
    include: CON_RELACIONES,
  });

  const ahora = Date.now();
  const VENTANA_MIN = 90 * 60 * 1000; // +90 min
  const VENTANA_MAX = 150 * 60 * 1000; // +150 min

  let enviados = 0;
  for (const cita of citas) {
    const inicio = instanteDeCita(cita.fecha, cita.horaInicio).getTime();
    const delta = inicio - ahora;
    if (delta >= VENTANA_MIN && delta < VENTANA_MAX) {
      await enviarTexto(cita.cliente.telefono, T.recordatorio2h(aResumen(cita)));
      enviados++;
    }
  }
  if (enviados > 0) {
    console.log(`📨 Recordatorios 2h: ${enviados} enviado(s).`);
  }
}

/** Programa ambos jobs de recordatorio. Llamar una vez al arrancar el servidor. */
export function iniciarProgramador(): void {
  const opciones = { timezone: env.timezone };

  // Todos los días a las 09:00.
  cron.schedule(
    '0 9 * * *',
    () => {
      enviarRecordatorios24h().catch((e) =>
        console.error('❌ Error en recordatorios 24h:', e),
      );
    },
    opciones,
  );

  // Cada hora en punto.
  cron.schedule(
    '0 * * * *',
    () => {
      enviarRecordatorios2h().catch((e) => console.error('❌ Error en recordatorios 2h:', e));
    },
    opciones,
  );

  console.log(`⏰ Programador de recordatorios iniciado (TZ: ${env.timezone}).`);
}
