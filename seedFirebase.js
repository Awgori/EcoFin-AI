const { db } = require('./src/services/firebase');
 
const users = {
  user_001: {
    name: 'Steve Ivan Garado',
    psid: '26195421383416528',
    whatsapp: '639690901019',
    location: 'Cavite, Philippines',
    totalCatches: 156,
    fishingHours: 85,
    achievements: 36,
    successRate: 92,
    memberSince: 'February 2026',
    messengerConnected: true,
    whatsappConnected: true,
  },
  user_002: {
    name: 'Maria Santos',
    psid: 'demo_user_002',
    whatsapp: '639289876543',
    location: 'Cebu, Philippines',
    totalCatches: 89,
    fishingHours: 72,
    achievements: 18,
    successRate: 85,
    memberSince: 'March 2023',
    messengerConnected: false,
    whatsappConnected: false,
  },
};
 
const catches = {
  user_001: {
    catch_001: { fish: 'Tuna', weight: '25.5 kg', size: '45-60 cm', location: 'North Atlantic', date: 'Jan 15, 2024' },
    catch_002: { fish: 'Cod',  weight: '18.2 kg', size: '40-55 cm', location: 'Pacific Ocean',  date: 'Jan 16, 2024' },
  },
  user_002: {
    catch_001: { fish: 'Mackerel', weight: '12.0 kg', size: '30-40 cm', location: 'Mediterranean', date: 'Jan 16, 2024' },
  },
};
 
async function seed() {
  await db.ref('users').set(users);
  await db.ref('catches').set(catches);
  console.log('✅ Firebase seeded successfully!');
  process.exit(0);
}
 
seed().catch(console.error);
