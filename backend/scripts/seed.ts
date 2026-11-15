import prisma from '../lib/prisma';
import { hashPassword } from '../lib/auth';

async function seed() {
  console.log('--- AgriDirect Database Seed & Health Check ---');

  // 1. Ensure Admin Account
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@agridirect.ai';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin@123';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await hashPassword(adminPassword);
    await prisma.user.create({
      data: {
        email: adminEmail,
        hashedPassword,
        role: 'admin',
        isActive: true,
        isVerified: true,
      },
    });
    console.log(`[Seed] Created admin account: ${adminEmail}`);
  } else {
    const hashedPassword = await hashPassword(adminPassword);
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { role: 'admin', hashedPassword },
    });
    console.log(`[Seed] Updated admin account credentials: ${adminEmail}`);
  }

  // 2. Ensure Vehicle Rates
  const rateCount = await prisma.vehicle_rates.count();
  if (rateCount === 0) {
    await prisma.vehicle_rates.createMany({
      data: [
        {
          vehicle_type: 'BIKE',
          base_fare: 30.0,
          rate_per_km: 8.0,
          minimum_fare: 40.0,
          loading_unloading_charge: 0.0,
          waiting_charge_per_hour: 0.0,
          active: true,
        },
        {
          vehicle_type: 'MINI_TRUCK',
          base_fare: 150.0,
          rate_per_km: 18.0,
          minimum_fare: 200.0,
          loading_unloading_charge: 50.0,
          waiting_charge_per_hour: 100.0,
          active: true,
        },
        {
          vehicle_type: 'TRUCK',
          base_fare: 300.0,
          rate_per_km: 25.0,
          minimum_fare: 350.0,
          loading_unloading_charge: 100.0,
          waiting_charge_per_hour: 150.0,
          active: true,
        },
      ],
    });
    console.log('[Seed] Created default vehicle pricing rates');
  }

  // 3. Ensure Logistics Settings
  const settingCount = await prisma.logistics_settings.count();
  if (settingCount === 0) {
    await prisma.logistics_settings.createMany({
      data: [
        {
          setting_key: 'truck_min_fill_pct',
          setting_value: '35.0',
          description: 'Minimum payload fill percentage required for truck dispatch',
        },
        {
          setting_key: 'bike_max_capacity_kg',
          setting_value: '50.0',
          description: 'Maximum payload weight in kg for two-wheeler / bike dispatch',
        },
        {
          setting_key: 'loading_unloading_fee',
          setting_value: '50.0',
          description: 'Standard loading/unloading fee per warehouse stop',
        },
      ],
    });
    console.log('[Seed] Created default logistics settings');
  }

  // 4. Default categories if empty
  const catCount = await prisma.category.count();
  if (catCount === 0) {
    await prisma.category.createMany({
      data: [
        { name: 'Vegetables' },
        { name: 'Fruits' },
        { name: 'Grains & Cereals' },
        { name: 'Spices' },
        { name: 'Pulses' },
      ],
    });
    console.log('[Seed] Created default categories');
  }

  console.log('[Seed] Complete!');
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
