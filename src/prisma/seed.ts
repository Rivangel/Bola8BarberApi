import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient, EstadoCita, RolUsuario } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Pobla la base de datos con datos iniciales:
 *  - 3 barberos
 *  - 5 servicios
 *  - clientes de ejemplo (Veracruz, lada 271) con notas del barbero
 *  - varias citas repartidas en los próximos días
 *
 * Idempotente: barberos/servicios por nombre, clientes por teléfono (upsert);
 * las citas solo se crean si la tabla está vacía.
 */

/** Día a medianoche UTC, con un desplazamiento en días desde hoy. */
function diaUTC(offsetDias: number): Date {
  const ahora = new Date();
  const d = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + offsetDias);
  return d;
}

/** Suma minutos a una hora "HH:MM" y devuelve "HH:MM". */
function sumarMinutos(hhmm: string, minutos: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutos;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

async function main() {
  console.log('🌱 Sembrando datos iniciales de Bola 8 Barbería...');

  // ── Barberos ────────────────────────────────────────────────
  const barberos = [
    { nombre: 'Carlos "El Tijeras" Méndez' },
    { nombre: 'Diego Ramírez' },
    { nombre: 'Luis Ángel Torres' },
  ];
  for (const b of barberos) {
    const existente = await prisma.barbero.findFirst({ where: { nombre: b.nombre } });
    if (!existente) {
      await prisma.barbero.create({ data: { nombre: b.nombre, activo: true } });
    }
  }

  // ── Usuario administrador (login del panel) ─────────────────
  // Credenciales por defecto (cámbialas en producción):
  //   email: admin@bola8.com   ·   contraseña: admin1234
  const adminEmail = 'admin@bola8.com';
  const adminPassword = 'admin1234';
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.usuario.upsert({
    where: { email: adminEmail },
    update: {}, // no pisamos la contraseña si ya existe
    create: {
      nombre: 'Administrador',
      email: adminEmail,
      passwordHash,
      rol: RolUsuario.ADMIN,
    },
  });

  // ── Servicios ───────────────────────────────────────────────
  // Catálogo en pesos mexicanos (MXN). Los nombres coinciden con los del app
  // (`SERVICES` en types.ts) para que al agendar se resuelva el servicio por nombre.
  const servicios = [
    { nombre: 'Corte', duracionMinutos: 30, precio: 120.0 },
    { nombre: 'Barba', duracionMinutos: 20, precio: 90.0 },
    { nombre: 'Corte + Barba', duracionMinutos: 45, precio: 190.0 },
    { nombre: 'Afeitado clásico', duracionMinutos: 30, precio: 110.0 },
  ];
  for (const s of servicios) {
    const existente = await prisma.servicio.findFirst({ where: { nombre: s.nombre } });
    if (!existente) {
      await prisma.servicio.create({ data: s });
    }
  }

  // ── Clientes (Veracruz, lada 271 — Orizaba) con notas ───────
  const clientes = [
    { nombre: 'José Hernández', telefono: '+52 271 712 3456', notas: 'Prefiere degradado bajo. Cliente habitual desde 2021.' },
    { nombre: 'Miguel Ángel Rivera', telefono: '+52 271 145 8890', notas: 'Alérgico a geles con alcohol; usar producto neutro.' },
    { nombre: 'Fernando Cruz', telefono: '+52 271 203 7711', notas: 'Le gusta platicar de fútbol. Siempre pide café.' },
    { nombre: 'Ricardo Domínguez', telefono: '+52 271 988 2034', notas: 'Barba cerrada, máquina del 1. Muy puntual.' },
    { nombre: 'Alejandro Vargas', telefono: '+52 271 556 1290', notas: 'Remolino en la coronilla; cuidado al peinar.' },
    { nombre: 'Carlos Mendoza', telefono: '+52 271 410 6677', notas: 'Suele reagendar; conviene confirmar un día antes.' },
    { nombre: 'Luis Fernando Ortiz', telefono: '+52 271 332 9015', notas: null },
    { nombre: 'Sergio Ramírez', telefono: '+52 271 778 4521', notas: 'Corte clásico con raya marcada a la izquierda.' },
  ];
  for (const c of clientes) {
    await prisma.cliente.upsert({
      where: { telefono: c.telefono },
      update: { nombre: c.nombre, notas: c.notas },
      create: c,
    });
  }

  // ── Citas de ejemplo (solo si no hay ninguna) ───────────────
  const totalCitas = await prisma.cita.count();
  if (totalCitas === 0) {
    const barberosBD = await prisma.barbero.findMany({ orderBy: { id: 'asc' } });
    const serviciosBD = await prisma.servicio.findMany({ orderBy: { id: 'asc' } });

    // { tel, b: índice de barbero, s: índice de servicio, off: días desde hoy, hi: hora inicio }
    const plan = [
      { tel: clientes[0].telefono, b: 0, s: 1, off: 0, hi: '11:00', estado: EstadoCita.CONFIRMADA },
      { tel: clientes[1].telefono, b: 1, s: 0, off: 0, hi: '11:30', estado: EstadoCita.CONFIRMADA },
      { tel: clientes[2].telefono, b: 2, s: 2, off: 0, hi: '12:00', estado: EstadoCita.PENDIENTE },
      { tel: clientes[3].telefono, b: 0, s: 3, off: 0, hi: '13:00', estado: EstadoCita.CONFIRMADA },
      { tel: clientes[4].telefono, b: 1, s: 3, off: 1, hi: '11:30', estado: EstadoCita.CONFIRMADA },
      { tel: clientes[5].telefono, b: 2, s: 0, off: 1, hi: '12:30', estado: EstadoCita.PENDIENTE },
      { tel: clientes[6].telefono, b: 0, s: 1, off: 2, hi: '16:00', estado: EstadoCita.CONFIRMADA },
      { tel: clientes[7].telefono, b: 1, s: 2, off: 2, hi: '17:00', estado: EstadoCita.CONFIRMADA },
      { tel: clientes[0].telefono, b: 2, s: 0, off: 3, hi: '11:30', estado: EstadoCita.PENDIENTE },
      { tel: clientes[3].telefono, b: 0, s: 1, off: 3, hi: '13:00', estado: EstadoCita.CONFIRMADA },
    ];

    for (const p of plan) {
      const cliente = await prisma.cliente.findUnique({ where: { telefono: p.tel } });
      const barbero = barberosBD[p.b];
      const servicio = serviciosBD[p.s];
      if (!cliente || !barbero || !servicio) continue;

      await prisma.cita.create({
        data: {
          clienteId: cliente.id,
          barberoId: barbero.id,
          servicioId: servicio.id,
          fecha: diaUTC(p.off),
          horaInicio: p.hi,
          horaFin: sumarMinutos(p.hi, servicio.duracionMinutos),
          estado: p.estado,
        },
      });
    }
  }

  const [tb, ts, tc, tcit, tu] = await Promise.all([
    prisma.barbero.count(),
    prisma.servicio.count(),
    prisma.cliente.count(),
    prisma.cita.count(),
    prisma.usuario.count(),
  ]);
  console.log(
    `✅ Listo. Barberos: ${tb}, Servicios: ${ts}, Clientes: ${tc}, Citas: ${tcit}, Usuarios: ${tu}`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Error al sembrar datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
