const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const tenants = await prisma.tenant.findMany();
  console.log('Tenants:', tenants);
  const users = await prisma.user.findMany();
  console.log('Users:', users);
  const barbers = await prisma.barber.findMany();
  console.log('Barbers:', barbers);
}

check();
