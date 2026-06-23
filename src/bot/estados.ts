/**
 * Estados de la máquina de conversación del bot.
 * Se persisten como cadena en Conversacion.estado.
 */
export enum Estado {
  INICIO = 'INICIO',

  // Flujo de agendado
  ESPERANDO_SERVICIO = 'ESPERANDO_SERVICIO',
  ESPERANDO_BARBERO = 'ESPERANDO_BARBERO',
  ESPERANDO_FECHA = 'ESPERANDO_FECHA',
  ESPERANDO_HORA = 'ESPERANDO_HORA',
  ESPERANDO_NOMBRE = 'ESPERANDO_NOMBRE',
  CONFIRMAR_CITA = 'CONFIRMAR_CITA',

  // Flujo de cancelación
  CANCELAR_SELECCION = 'CANCELAR_SELECCION',

  // Flujo de reagendado
  REAGENDAR_SELECCION = 'REAGENDAR_SELECCION',
  REAGENDAR_FECHA = 'REAGENDAR_FECHA',
  REAGENDAR_HORA = 'REAGENDAR_HORA',
}

/**
 * Datos temporales que se acumulan durante un flujo. Se guardan como JSON
 * en Conversacion.datosTemp y se limpian al terminar o reiniciar el flujo.
 */
export interface DatosTemp {
  // Agendado
  servicioId?: number;
  servicioNombre?: string;
  duracionMinutos?: number;
  precio?: string | number;
  barberoId?: number | null; // null = sin preferencia
  barberoNombre?: string;
  fechaISO?: string; // ISO del día (medianoche UTC)
  horaInicio?: string;
  horaFin?: string;
  clienteNombre?: string;

  // Reagendado: ID de la cita que se está moviendo
  citaIdReagendar?: number;

  // Listas ofrecidas (para mapear el número elegido a un ID/valor real)
  serviciosIds?: number[];
  barberosIds?: number[];
  horariosOfrecidos?: string[];
  citasIds?: number[];
}
