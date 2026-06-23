import { formatearFechaLegible } from '../utils/dates';

/**
 * Plantillas de mensajes del bot, todas en español (México).
 * Son funciones puras que devuelven el texto listo para enviar por WhatsApp.
 */

const NOMBRE_NEGOCIO = 'Bola 8 Barbería';

/** Formatea un precio (number/string/Decimal) como "$150.00 MXN". */
export function formatearPrecio(precio: unknown): string {
  const n = Number(precio);
  return `$${n.toFixed(2)} MXN`;
}

export interface ResumenCitaData {
  servicio: string;
  barbero: string;
  precio: unknown;
  fecha: Date;
  horaInicio: string;
  horaFin: string;
  cliente?: string;
}

/** Menú de bienvenida con las opciones disponibles. */
export function bienvenida(): string {
  return (
    `💈 *¡Bienvenido a ${NOMBRE_NEGOCIO}!* 🎱\n\n` +
    `Soy tu asistente virtual. ¿En qué te puedo ayudar?\n\n` +
    `Escribe una opción:\n` +
    `📅 *Agendar* — reservar una cita\n` +
    `🔁 *Reagendar* — cambiar una cita\n` +
    `❌ *Cancelar* — cancelar una cita\n` +
    `📋 *Mis citas* — ver tus próximas citas\n\n` +
    `Solo escribe la palabra que quieras. 😉`
  );
}

/** Lista numerada de servicios con duración y precio. */
export function listaServicios(
  servicios: { id: number; nombre: string; duracionMinutos: number; precio: unknown }[],
): string {
  const lineas = servicios
    .map(
      (s, i) =>
        `*${i + 1}.* ${s.nombre} — ${formatearPrecio(s.precio)} _(${s.duracionMinutos} min)_`,
    )
    .join('\n');
  return (
    `✂️ *Nuestros servicios:*\n\n${lineas}\n\n` +
    `Responde con el *número* del servicio que deseas.`
  );
}

/** Lista numerada de barberos, con opción "sin preferencia". */
export function listaBarberos(barberos: { id: number; nombre: string }[]): string {
  const lineas = barberos.map((b, i) => `*${i + 1}.* ${b.nombre}`).join('\n');
  const sinPref = barberos.length + 1;
  return (
    `💇 *¿Con qué barbero te gustaría?*\n\n${lineas}\n` +
    `*${sinPref}.* Sin preferencia\n\n` +
    `Responde con el *número* de tu elección.`
  );
}

/** Solicita la fecha de la cita. */
export function pedirFecha(): string {
  return (
    `📅 *¿Para qué día quieres tu cita?*\n\n` +
    `Escríbela en formato *DD/MM/AAAA*.\n` +
    `Por ejemplo: *25/06/2026*`
  );
}

/** Lista numerada de horarios disponibles. */
export function listaHorarios(horarios: string[]): string {
  const lineas = horarios.map((h, i) => `*${i + 1}.* ${h}`).join('\n');
  return (
    `🕐 *Horarios disponibles:*\n\n${lineas}\n\n` +
    `Responde con el *número* del horario que prefieras.`
  );
}

/** Solicita el nombre del cliente. */
export function pedirNombre(): string {
  return `📝 *¿A nombre de quién registramos la cita?*\nEscribe tu nombre completo, por favor.`;
}

/** Resumen previo a la confirmación. */
export function resumenCita(d: ResumenCitaData): string {
  return (
    `📋 *Confirma los datos de tu cita:*\n\n` +
    (d.cliente ? `👤 Cliente: *${d.cliente}*\n` : '') +
    `✂️ Servicio: *${d.servicio}*\n` +
    `💇 Barbero: *${d.barbero}*\n` +
    `📅 Fecha: *${formatearFechaLegible(d.fecha)}*\n` +
    `🕐 Hora: *${d.horaInicio} a ${d.horaFin}*\n` +
    `💵 Precio: *${formatearPrecio(d.precio)}*\n\n` +
    `¿Confirmar? Responde *SÍ* o *NO*.`
  );
}

/** Mensaje de cita confirmada y guardada. */
export function citaConfirmada(d: ResumenCitaData): string {
  return (
    `✅ *¡Tu cita está confirmada!* 🎉\n\n` +
    `✂️ Servicio: *${d.servicio}*\n` +
    `💇 Barbero: *${d.barbero}*\n` +
    `📅 Fecha: *${formatearFechaLegible(d.fecha)}*\n` +
    `🕐 Hora: *${d.horaInicio}*\n` +
    `💵 Precio: *${formatearPrecio(d.precio)}*\n\n` +
    `📍 Te esperamos en ${NOMBRE_NEGOCIO}.\n` +
    `Te enviaremos un recordatorio antes de tu cita. ¡Gracias! 🙌`
  );
}

/** Mensaje de cita reagendada con éxito. */
export function reagendadoConfirmado(d: ResumenCitaData): string {
  return (
    `🔁 *¡Tu cita fue reagendada!* ✅\n\n` +
    `✂️ Servicio: *${d.servicio}*\n` +
    `💇 Barbero: *${d.barbero}*\n` +
    `📅 Nueva fecha: *${formatearFechaLegible(d.fecha)}*\n` +
    `🕐 Nueva hora: *${d.horaInicio}*\n\n` +
    `Te esperamos en ${NOMBRE_NEGOCIO}. ¡Gracias! 🙌`
  );
}

/** Recordatorio 24 horas antes. */
export function recordatorio24h(d: ResumenCitaData): string {
  return (
    `⏰ *Recordatorio de tu cita en ${NOMBRE_NEGOCIO}*\n\n` +
    `¡Hola${d.cliente ? ` ${d.cliente}` : ''}! Te recordamos que *mañana* tienes cita:\n\n` +
    `✂️ ${d.servicio}\n` +
    `💇 ${d.barbero}\n` +
    `📅 ${formatearFechaLegible(d.fecha)}\n` +
    `🕐 ${d.horaInicio}\n\n` +
    `Si necesitas *cancelar* o *reagendar*, escríbenos. ¡Te esperamos! 💈`
  );
}

/** Recordatorio 2 horas antes. */
export function recordatorio2h(d: ResumenCitaData): string {
  return (
    `⏰ *¡Tu cita es en un par de horas!*\n\n` +
    `${d.cliente ? `${d.cliente}, t` : 'T'}u cita en ${NOMBRE_NEGOCIO} es hoy a las *${d.horaInicio}*.\n` +
    `✂️ ${d.servicio} con ${d.barbero}.\n\n` +
    `¡Te esperamos! 🎱`
  );
}

/** Confirmación de cancelación. */
export function cancelacionConfirmada(d: ResumenCitaData): string {
  return (
    `❌ *Cita cancelada*\n\n` +
    `Tu cita del *${formatearFechaLegible(d.fecha)}* a las *${d.horaInicio}* ha sido cancelada.\n\n` +
    `Cuando quieras, escribe *agendar* para reservar de nuevo. ¡Aquí estamos! 💈`
  );
}

/** Lista de próximas citas del cliente. */
export function misCitas(
  citas: ResumenCitaData[],
  opciones?: { numerada?: boolean; titulo?: string },
): string {
  if (citas.length === 0) {
    return `📭 No tienes citas próximas.\n\nEscribe *agendar* para reservar una. 💈`;
  }
  const titulo = opciones?.titulo ?? '📋 *Tus próximas citas:*';
  const lineas = citas
    .map((c, i) => {
      const prefijo = opciones?.numerada ? `*${i + 1}.* ` : '• ';
      return (
        `${prefijo}*${formatearFechaLegible(c.fecha)}* a las *${c.horaInicio}*\n` +
        `   ${c.servicio} con ${c.barbero}`
      );
    })
    .join('\n\n');
  return `${titulo}\n\n${lineas}`;
}

/** No hay horarios disponibles para ese día/barbero. */
export function sinHorarios(): string {
  return (
    `😕 Lo sentimos, no hay horarios disponibles para esa fecha.\n` +
    `Escribe otra fecha en formato *DD/MM/AAAA*.`
  );
}

/** Fecha con formato inválido. */
export function fechaInvalida(): string {
  return `⚠️ No entendí la fecha. Escríbela en formato *DD/MM/AAAA*, por ejemplo *25/06/2026*.`;
}

/** Fecha en el pasado. */
export function fechaPasada(): string {
  return `⚠️ Esa fecha ya pasó. Por favor escribe una fecha de hoy en adelante (*DD/MM/AAAA*).`;
}

/** Opción inválida en un menú numerado. */
export function opcionInvalida(): string {
  return `⚠️ Opción no válida. Por favor responde con uno de los *números* de la lista.`;
}

/** Mensaje genérico de error. */
export function errorGenerico(): string {
  return (
    `😅 Uy, algo salió mal de nuestro lado. Intentémoslo de nuevo.\n\n` +
    `Escribe *agendar* para empezar otra vez o *menú* para ver las opciones.`
  );
}

/** Mensaje cuando no se entiende la intención. */
export function noEntendido(): string {
  return (
    `🤔 No estoy seguro de haber entendido.\n\n` +
    `Puedes escribir:\n` +
    `📅 *Agendar* · 🔁 *Reagendar* · ❌ *Cancelar* · 📋 *Mis citas*`
  );
}

/** Aviso de que no hay nada que cancelar/reagendar. */
export function sinCitasParaGestionar(): string {
  return (
    `📭 No encontramos citas activas a tu nombre.\n\n` +
    `Escribe *agendar* para reservar una cita. 💈`
  );
}
