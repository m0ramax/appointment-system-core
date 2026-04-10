import { PrismaClient, UserRole, DayOfWeek } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding...');

  // Business
  const business = await prisma.business.upsert({
    where: { whatsappNumber: '+14155238886' },
    update: {},
    create: {
      name: 'Mi Negocio',
      whatsappNumber: '+14155238886',
      allowProviderSelection: false,
    },
  });
  console.log('Business:', business.name);

  // Owner
  const owner = await prisma.user.upsert({
    where: { email: 'owner@test.com' },
    update: {},
    create: {
      email: 'owner@test.com',
      hashedPassword: await bcrypt.hash('123456', 10),
      role: UserRole.OWNER,
      businessId: business.id,
    },
  });
  console.log('Owner:', owner.email);

  // Provider
  const provider = await prisma.user.upsert({
    where: { email: 'provider@test.com' },
    update: {},
    create: {
      email: 'provider@test.com',
      hashedPassword: await bcrypt.hash('123456', 10),
      role: UserRole.PROVIDER,
      businessId: business.id,
    },
  });
  console.log('Provider:', provider.email);

  // Services
  const services = ['Consulta General', 'Consulta de Seguimiento', 'Revisión'];
  for (const name of services) {
    await prisma.service.upsert({
      where: { id: (await prisma.service.findFirst({ where: { name, businessId: business.id } }))?.id ?? 0 },
      update: {},
      create: { name, durationMinutes: 30, businessId: business.id },
    });
  }
  console.log('Services created');

  // Work schedule (Mon-Fri 9-17)
  const days = [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY];
  for (const dayOfWeek of days) {
    await prisma.workSchedule.upsert({
      where: { providerId_dayOfWeek: { providerId: provider.id, dayOfWeek } },
      update: {},
      create: {
        providerId: provider.id,
        dayOfWeek,
        startTime: '09:00',
        endTime: '17:00',
        slotDurationMinutes: 30,
        breakStart: '13:00',
        breakEnd: '14:00',
      },
    });
  }
  console.log('Work schedule created');

  console.log('Done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
