import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Pobla la base de datos con datos iniciales:
 *  - 3 barberos
 *  - 5 servicios
 * Es idempotente: usa `upsert` por nombre para no duplicar al re-ejecutar.
 */
async function main() {
  console.log('🌱 Sembrando datos iniciales de Bola 8 Barbería...');

  const barberos = [
    { nombre: 'Carlos "El Tijeras" Méndez' },
    { nombre: 'Diego Ramírez' },
    { nombre: 'Luis Ángel Torres' },
  ];

  for (const b of barberos) {
    // No hay índice único en `nombre`, así que evitamos duplicados manualmente.
    const existente = await prisma.barbero.findFirst({ where: { nombre: b.nombre } });
    if (!existente) {
      await prisma.barbero.create({ data: { nombre: b.nombre, activo: true } });
    }
  }

  const servicios = [
    { nombre: 'Corte de cabello', duracionMinutos: 30, precio: 150.0 },
    { nombre: 'Corte + Barba', duracionMinutos: 45, precio: 220.0 },
    { nombre: 'Arreglo de barba', duracionMinutos: 20, precio: 100.0 },
    { nombre: 'Corte infantil', duracionMinutos: 30, precio: 120.0 },
    { nombre: 'Corte + Diseño', duracionMinutos: 60, precio: 280.0 },
  ];

  for (const s of servicios) {
    const existente = await prisma.servicio.findFirst({ where: { nombre: s.nombre } });
    if (!existente) {
      await prisma.servicio.create({ data: s });
    }
  }

  const totalBarberos = await prisma.barbero.count();
  const totalServicios = await prisma.servicio.count();
  console.log(`✅ Listo. Barberos: ${totalBarberos}, Servicios: ${totalServicios}`);
}

main()
  .catch((e) => {
    console.error('❌ Error al sembrar datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
