import prisma from '../prisma/client';
import * as T from '../services/templates.service';
import * as conv from './conversacion.repo';
import { Estado, DatosTemp } from './estados';
import { Intencion, detectarIntencion, esComandoSalir } from './intents';
import {
  getHorariosDisponibles,
  getHorariosDisponiblesCualquiera,
  getBarberoDisponible,
} from '../services/availability.service';
import {
  crearCita,
  actualizarCita,
  cancelarCita,
  citasProximasPorTelefono,
  ErrorDeNegocio,
} from '../services/citas.service';
import { buscarPorTelefono, obtenerOCrear } from '../services/clientes.service';
import {
  sanitizarTexto,
  extraerNumero,
  esAfirmacion,
  esNegacion,
  esNombreValido,
} from '../utils/validators';
import { parsearFecha, esFechaPasada, sumarMinutos } from '../utils/dates';

/**
 * Máquina de estados de la conversación del bot de WhatsApp.
 *
 * `procesarMensaje` recibe el texto del usuario, avanza el flujo según el
 * estado persistido en la tabla Conversacion y devuelve los mensajes a enviar.
 *
 * Cualquier excepción no controlada se captura: se reinicia la conversación y
 * se devuelve un mensaje de error amistoso en español.
 */
export async function procesarMensaje(telefono: string, textoRaw: string): Promise<string[]> {
  const texto = sanitizarTexto(textoRaw);

  if (!texto) {
    return [T.noEntendido()];
  }

  try {
    const { estado, datos } = await conv.cargar(telefono);

    // El usuario puede abortar el flujo en cualquier momento.
    if (estado !== Estado.INICIO && esComandoSalir(texto)) {
      await conv.reiniciar(telefono);
      return [T.bienvenida()];
    }

    switch (estado) {
      case Estado.INICIO:
        return await manejarInicio(telefono, texto);

      // ── Flujo de agendado ──────────────────────────────────────────
      case Estado.ESPERANDO_SERVICIO:
        return await manejarServicio(telefono, texto, datos);
      case Estado.ESPERANDO_BARBERO:
        return await manejarBarbero(telefono, texto, datos);
      case Estado.ESPERANDO_FECHA:
        return await manejarFecha(telefono, texto, datos);
      case Estado.ESPERANDO_HORA:
        return await manejarHora(telefono, texto, datos);
      case Estado.ESPERANDO_NOMBRE:
        return await manejarNombre(telefono, texto, datos);
      case Estado.CONFIRMAR_CITA:
        return await manejarConfirmacion(telefono, texto, datos);

      // ── Flujo de cancelación ───────────────────────────────────────
      case Estado.CANCELAR_SELECCION:
        return await manejarCancelarSeleccion(telefono, texto, datos);

      // ── Flujo de reagendado ────────────────────────────────────────
      case Estado.REAGENDAR_SELECCION:
        return await manejarReagendarSeleccion(telefono, texto, datos);
      case Estado.REAGENDAR_FECHA:
        return await manejarReagendarFecha(telefono, texto, datos);
      case Estado.REAGENDAR_HORA:
        return await manejarReagendarHora(telefono, texto, datos);

      default:
        // Estado desconocido: reiniciamos por seguridad.
        await conv.reiniciar(telefono);
        return [T.bienvenida()];
    }
  } catch (error) {
    console.error(`❌ Error procesando mensaje de ${telefono}:`, error);
    // Ante cualquier fallo, reiniciamos el flujo y mandamos un mensaje amable.
    await conv.reiniciar(telefono).catch(() => undefined);
    return [T.errorGenerico()];
  }
}

// ─────────────────────────────────────────────────────────────────────
// Enrutado inicial por intención
// ─────────────────────────────────────────────────────────────────────

async function manejarInicio(telefono: string, texto: string): Promise<string[]> {
  const intencion = detectarIntencion(texto);
  switch (intencion) {
    case Intencion.AGENDAR:
      return await iniciarAgendado(telefono);
    case Intencion.CANCELAR:
      return await iniciarCancelacion(telefono);
    case Intencion.REAGENDAR:
      return await iniciarReagendado(telefono);
    case Intencion.MIS_CITAS:
      return await mostrarMisCitas(telefono);
    case Intencion.MENU:
    case Intencion.DESCONOCIDO:
    default:
      return [T.bienvenida()];
  }
}

async function mostrarMisCitas(telefono: string): Promise<string[]> {
  const citas = await citasProximasPorTelefono(telefono);
  return [T.misCitas(citas.map(aResumen))];
}

// ─────────────────────────────────────────────────────────────────────
// Flujo de agendado
// ─────────────────────────────────────────────────────────────────────

async function iniciarAgendado(telefono: string): Promise<string[]> {
  const servicios = await prisma.servicio.findMany({ orderBy: { id: 'asc' } });
  if (servicios.length === 0) {
    return [T.errorGenerico()];
  }
  const datos: DatosTemp = { serviciosIds: servicios.map((s) => s.id) };
  await conv.guardar(telefono, Estado.ESPERANDO_SERVICIO, datos);
  return [T.listaServicios(servicios)];
}

async function manejarServicio(
  telefono: string,
  texto: string,
  datos: DatosTemp,
): Promise<string[]> {
  const n = extraerNumero(texto);
  const ids = datos.serviciosIds ?? [];
  if (!n || n < 1 || n > ids.length) {
    return [T.opcionInvalida()];
  }

  const servicio = await prisma.servicio.findUnique({ where: { id: ids[n - 1] } });
  if (!servicio) return [T.errorGenerico()];

  const barberos = await prisma.barbero.findMany({
    where: { activo: true },
    orderBy: { id: 'asc' },
  });
  if (barberos.length === 0) return [T.errorGenerico()];

  const nuevos: DatosTemp = {
    ...datos,
    servicioId: servicio.id,
    servicioNombre: servicio.nombre,
    duracionMinutos: servicio.duracionMinutos,
    precio: servicio.precio.toString(),
    barberosIds: barberos.map((b) => b.id),
  };
  await conv.guardar(telefono, Estado.ESPERANDO_BARBERO, nuevos);
  return [T.listaBarberos(barberos)];
}

async function manejarBarbero(
  telefono: string,
  texto: string,
  datos: DatosTemp,
): Promise<string[]> {
  const n = extraerNumero(texto);
  const ids = datos.barberosIds ?? [];
  const opcionSinPref = ids.length + 1;

  let barberoId: number | null;
  let barberoNombre: string;

  if (n === opcionSinPref) {
    barberoId = null;
    barberoNombre = 'Sin preferencia';
  } else if (n && n >= 1 && n <= ids.length) {
    barberoId = ids[n - 1];
    const barbero = await prisma.barbero.findUnique({ where: { id: barberoId } });
    barberoNombre = barbero?.nombre ?? 'Sin preferencia';
  } else {
    return [T.opcionInvalida()];
  }

  const nuevos: DatosTemp = { ...datos, barberoId, barberoNombre };
  await conv.guardar(telefono, Estado.ESPERANDO_FECHA, nuevos);
  return [T.pedirFecha()];
}

async function manejarFecha(telefono: string, texto: string, datos: DatosTemp): Promise<string[]> {
  const fecha = parsearFecha(texto);
  if (!fecha) return [T.fechaInvalida()];
  if (esFechaPasada(fecha)) return [T.fechaPasada()];

  const duracion = datos.duracionMinutos ?? 30;
  const horarios =
    datos.barberoId == null
      ? await getHorariosDisponiblesCualquiera(fecha, duracion)
      : await getHorariosDisponibles(fecha, datos.barberoId, duracion);

  if (horarios.length === 0) {
    return [T.sinHorarios()];
  }

  const nuevos: DatosTemp = {
    ...datos,
    fechaISO: fecha.toISOString(),
    horariosOfrecidos: horarios,
  };
  await conv.guardar(telefono, Estado.ESPERANDO_HORA, nuevos);
  return [T.listaHorarios(horarios)];
}

async function manejarHora(telefono: string, texto: string, datos: DatosTemp): Promise<string[]> {
  const n = extraerNumero(texto);
  const horarios = datos.horariosOfrecidos ?? [];
  if (!n || n < 1 || n > horarios.length) {
    return [T.opcionInvalida()];
  }

  const hora = horarios[n - 1];
  const duracion = datos.duracionMinutos ?? 30;
  const fecha = new Date(datos.fechaISO!);
  const horaFin = sumarMinutos(hora, duracion);

  let barberoId = datos.barberoId ?? null;
  let barberoNombre = datos.barberoNombre ?? 'Sin preferencia';

  // "Sin preferencia": asignamos un barbero libre en ese horario.
  if (barberoId == null) {
    const asignado = await getBarberoDisponible(fecha, hora, duracion);
    if (!asignado) {
      // El horario se ocupó mientras tanto: volvemos a pedir hora.
      const refresco = await getHorariosDisponiblesCualquiera(fecha, duracion);
      if (refresco.length === 0) {
        await conv.guardar(telefono, Estado.ESPERANDO_FECHA, datos);
        return [T.sinHorarios()];
      }
      await conv.guardar(telefono, Estado.ESPERANDO_HORA, {
        ...datos,
        horariosOfrecidos: refresco,
      });
      return ['😕 Ese horario se acaba de ocupar.', T.listaHorarios(refresco)];
    }
    barberoId = asignado;
    const barbero = await prisma.barbero.findUnique({ where: { id: asignado } });
    barberoNombre = barbero?.nombre ?? barberoNombre;
  }

  const nuevos: DatosTemp = {
    ...datos,
    horaInicio: hora,
    horaFin,
    barberoId,
    barberoNombre,
  };

  // ¿El cliente ya está registrado?
  const cliente = await buscarPorTelefono(telefono);
  if (cliente) {
    nuevos.clienteNombre = cliente.nombre;
    await conv.guardar(telefono, Estado.CONFIRMAR_CITA, nuevos);
    return [resumenDesdeDatos(nuevos)];
  }

  await conv.guardar(telefono, Estado.ESPERANDO_NOMBRE, nuevos);
  return [T.pedirNombre()];
}

async function manejarNombre(telefono: string, texto: string, datos: DatosTemp): Promise<string[]> {
  if (!esNombreValido(texto)) {
    return ['⚠️ Por favor escribe un nombre válido (solo tu nombre).', T.pedirNombre()];
  }
  const cliente = await obtenerOCrear(telefono, texto);
  const nuevos: DatosTemp = { ...datos, clienteNombre: cliente.nombre };
  await conv.guardar(telefono, Estado.CONFIRMAR_CITA, nuevos);
  return [resumenDesdeDatos(nuevos)];
}

async function manejarConfirmacion(
  telefono: string,
  texto: string,
  datos: DatosTemp,
): Promise<string[]> {
  if (esNegacion(texto)) {
    await conv.reiniciar(telefono);
    return ['👍 Cita no confirmada. Cuando quieras, escribe *agendar* para empezar de nuevo. 💈'];
  }

  if (!esAfirmacion(texto)) {
    return ['Por favor responde *SÍ* para confirmar o *NO* para cancelar.'];
  }

  // Confirmación: registramos al cliente (si hace falta) y creamos la cita.
  const nombre = datos.clienteNombre ?? 'Cliente';
  const cliente = await obtenerOCrear(telefono, nombre);
  const fecha = new Date(datos.fechaISO!);

  try {
    const cita = await crearCita({
      clienteId: cliente.id,
      barberoId: datos.barberoId!,
      servicioId: datos.servicioId!,
      fecha,
      horaInicio: datos.horaInicio!,
      horaFin: datos.horaFin!,
    });
    await conv.reiniciar(telefono);
    return [T.citaConfirmada(aResumen(cita))];
  } catch (error) {
    if (error instanceof ErrorDeNegocio) {
      // El horario se ocupó entre el resumen y la confirmación.
      await conv.guardar(telefono, Estado.ESPERANDO_FECHA, {
        servicioId: datos.servicioId,
        servicioNombre: datos.servicioNombre,
        duracionMinutos: datos.duracionMinutos,
        precio: datos.precio,
        barberoId: datos.barberoId,
        barberoNombre: datos.barberoNombre,
        clienteNombre: datos.clienteNombre,
      });
      return [
        '😕 Lo sentimos, ese horario acaba de ocuparse.',
        T.pedirFecha(),
      ];
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Flujo de cancelación
// ─────────────────────────────────────────────────────────────────────

async function iniciarCancelacion(telefono: string): Promise<string[]> {
  const citas = await citasProximasPorTelefono(telefono);
  if (citas.length === 0) {
    return [T.sinCitasParaGestionar()];
  }
  await conv.guardar(telefono, Estado.CANCELAR_SELECCION, { citasIds: citas.map((c) => c.id) });
  return [
    T.misCitas(citas.map(aResumen), {
      numerada: true,
      titulo: '❌ *¿Cuál cita deseas cancelar?*',
    }),
  ];
}

async function manejarCancelarSeleccion(
  telefono: string,
  texto: string,
  datos: DatosTemp,
): Promise<string[]> {
  const n = extraerNumero(texto);
  const ids = datos.citasIds ?? [];
  if (!n || n < 1 || n > ids.length) {
    return [T.opcionInvalida()];
  }
  const cita = await cancelarCita(ids[n - 1]);
  await conv.reiniciar(telefono);
  return [T.cancelacionConfirmada(aResumen(cita))];
}

// ─────────────────────────────────────────────────────────────────────
// Flujo de reagendado
// ─────────────────────────────────────────────────────────────────────

async function iniciarReagendado(telefono: string): Promise<string[]> {
  const citas = await citasProximasPorTelefono(telefono);
  if (citas.length === 0) {
    return [T.sinCitasParaGestionar()];
  }
  await conv.guardar(telefono, Estado.REAGENDAR_SELECCION, { citasIds: citas.map((c) => c.id) });
  return [
    T.misCitas(citas.map(aResumen), {
      numerada: true,
      titulo: '🔁 *¿Cuál cita deseas reagendar?*',
    }),
  ];
}

async function manejarReagendarSeleccion(
  telefono: string,
  texto: string,
  datos: DatosTemp,
): Promise<string[]> {
  const n = extraerNumero(texto);
  const ids = datos.citasIds ?? [];
  if (!n || n < 1 || n > ids.length) {
    return [T.opcionInvalida()];
  }

  const cita = await prisma.cita.findUnique({
    where: { id: ids[n - 1] },
    include: { servicio: true, barbero: true },
  });
  if (!cita) return [T.errorGenerico()];

  const nuevos: DatosTemp = {
    citaIdReagendar: cita.id,
    servicioId: cita.servicioId,
    servicioNombre: cita.servicio.nombre,
    duracionMinutos: cita.servicio.duracionMinutos,
    precio: cita.servicio.precio.toString(),
    barberoId: cita.barberoId,
    barberoNombre: cita.barbero.nombre,
  };
  await conv.guardar(telefono, Estado.REAGENDAR_FECHA, nuevos);
  return [T.pedirFecha()];
}

async function manejarReagendarFecha(
  telefono: string,
  texto: string,
  datos: DatosTemp,
): Promise<string[]> {
  const fecha = parsearFecha(texto);
  if (!fecha) return [T.fechaInvalida()];
  if (esFechaPasada(fecha)) return [T.fechaPasada()];

  const duracion = datos.duracionMinutos ?? 30;
  const horarios = await getHorariosDisponibles(fecha, datos.barberoId!, duracion);
  if (horarios.length === 0) {
    return [T.sinHorarios()];
  }

  await conv.guardar(telefono, Estado.REAGENDAR_HORA, {
    ...datos,
    fechaISO: fecha.toISOString(),
    horariosOfrecidos: horarios,
  });
  return [T.listaHorarios(horarios)];
}

async function manejarReagendarHora(
  telefono: string,
  texto: string,
  datos: DatosTemp,
): Promise<string[]> {
  const n = extraerNumero(texto);
  const horarios = datos.horariosOfrecidos ?? [];
  if (!n || n < 1 || n > horarios.length) {
    return [T.opcionInvalida()];
  }

  const hora = horarios[n - 1];
  const duracion = datos.duracionMinutos ?? 30;
  const horaFin = sumarMinutos(hora, duracion);
  const fecha = new Date(datos.fechaISO!);

  try {
    const cita = await actualizarCita(datos.citaIdReagendar!, {
      fecha,
      horaInicio: hora,
      horaFin,
    });
    await conv.reiniciar(telefono);
    return [T.reagendadoConfirmado(aResumen(cita))];
  } catch (error) {
    if (error instanceof ErrorDeNegocio) {
      await conv.guardar(telefono, Estado.REAGENDAR_FECHA, datos);
      return ['😕 Ese horario acaba de ocuparse.', T.pedirFecha()];
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

/** Convierte una cita con relaciones al formato de las plantillas. */
function aResumen(cita: {
  fecha: Date;
  horaInicio: string;
  horaFin: string;
  servicio: { nombre: string; precio: unknown };
  barbero: { nombre: string };
  cliente?: { nombre: string };
}): T.ResumenCitaData {
  return {
    servicio: cita.servicio.nombre,
    barbero: cita.barbero.nombre,
    precio: cita.servicio.precio,
    fecha: cita.fecha,
    horaInicio: cita.horaInicio,
    horaFin: cita.horaFin,
    cliente: cita.cliente?.nombre,
  };
}

/** Construye el resumen de confirmación a partir de los datos temporales. */
function resumenDesdeDatos(datos: DatosTemp): string {
  return T.resumenCita({
    servicio: datos.servicioNombre ?? '',
    barbero: datos.barberoNombre ?? '',
    precio: datos.precio ?? 0,
    fecha: new Date(datos.fechaISO!),
    horaInicio: datos.horaInicio ?? '',
    horaFin: datos.horaFin ?? '',
    cliente: datos.clienteNombre,
  });
}
