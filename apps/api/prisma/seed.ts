import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Barber
  const barber = await prisma.barber.upsert({
    where: { id: 'barber-1' },
    update: {},
    create: {
      id: 'barber-1',
      name: 'Juco',
      bio: 'Especialista en cortes premium y estilismo masculino.',
      avatarUrl: 'https://images.unsplash.com/photo-1599351431247-f10b21817021?auto=format&fit=crop&q=80',
    },
  });

  // 2. Create Services
  const services = [
    {
      id: 'service-1',
      name: 'Corte de Precisión',
      description: 'Corte artesanal con acabado detallado.',
      durationMinutes: 45,
      price: 45,
      barberId: barber.id,
    },
    {
      id: 'service-2',
      name: 'Escultura de Barba',
      description: 'Diseño y perfilado de barba con ritual de toalla caliente.',
      durationMinutes: 30,
      price: 30,
      barberId: barber.id,
    },
    {
      id: 'service-3',
      name: 'El Ritual Vaon',
      description: 'Experiencia completa: Corte + Barba + Tratamiento facial.',
      durationMinutes: 75,
      price: 70,
      barberId: barber.id,
    },
  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: {},
      create: service,
    });
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
