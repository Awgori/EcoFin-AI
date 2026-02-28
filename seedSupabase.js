require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const PASSWORD = 'EcoFin2025!';

// ─── 20 Users — exactly matching your column names ───────────
const users = [
    // ── Company Handlers ──────────────────────────────────────
    { id: 'user_001', name: 'Steve Ivan Garado',  email: 'steve@ecofin.com',      location: 'Batangas, Philippines'   },
    { id: 'user_002', name: 'Maria Santos',        email: 'maria@ecofin.com',      location: 'Manila, Philippines'     },
    { id: 'user_003', name: 'Juan dela Cruz',      email: 'juan@ecofin.com',       location: 'Cebu, Philippines'       },

    // ── Fisher Accounts ────────────────────────────────────────
    { id: 'user_004', name: 'Pedro Reyes',         email: 'pedro@ecofin.com',      location: 'Cavite, Philippines'     },
    { id: 'user_005', name: 'Rosa Mendoza',        email: 'rosa@ecofin.com',       location: 'Zambales, Philippines'   },
    { id: 'user_006', name: 'Carlos Bautista',     email: 'carlos@ecofin.com',     location: 'Palawan, Philippines'    },
    { id: 'user_007', name: 'Ana Villanueva',      email: 'ana@ecofin.com',        location: 'Iloilo, Philippines'     },
    { id: 'user_008', name: 'Ramon Torres',        email: 'ramon@ecofin.com',      location: 'Davao, Philippines'      },
    { id: 'user_009', name: 'Elena Castillo',      email: 'elena@ecofin.com',      location: 'Quezon, Philippines'     },
    { id: 'user_010', name: 'Miguel Garcia',       email: 'miguel@ecofin.com',     location: 'Bulacan, Philippines'    },
    { id: 'user_011', name: 'Luz Hernandez',       email: 'luz@ecofin.com',        location: 'Leyte, Philippines'      },
    { id: 'user_012', name: 'Fernando Aquino',     email: 'fernando@ecofin.com',   location: 'Samar, Philippines'      },
    { id: 'user_013', name: 'Cecilia Ramos',       email: 'cecilia@ecofin.com',    location: 'Mindoro, Philippines'    },
    { id: 'user_014', name: 'Roberto Flores',      email: 'roberto@ecofin.com',    location: 'Negros, Philippines'     },
    { id: 'user_015', name: 'Gloria Cruz',         email: 'gloria@ecofin.com',     location: 'Pampanga, Philippines'   },
    { id: 'user_016', name: 'Ernesto Morales',     email: 'ernesto@ecofin.com',    location: 'Laguna, Philippines'     },
    { id: 'user_017', name: 'Teresita Navarro',    email: 'teresita@ecofin.com',   location: 'Rizal, Philippines'      },
    { id: 'user_018', name: 'Andres Reyes',        email: 'andres@ecofin.com',     location: 'Bataan, Philippines'     },
    { id: 'user_019', name: 'Josefina Lim',        email: 'josefina@ecofin.com',   location: 'Pangasinan, Philippines' },
    { id: 'user_020', name: 'Domingo Santiago',    email: 'domingo@ecofin.com',    location: 'Mindanao, Philippines'   },
];

// ─── Sample catches matching your exact catches columns ───────
const catchPool = [
    { fish: 'Tuna',        weight: '25.5', size: '45cm - 60cm', source: 'Sea',   location: 'South China Sea',       depth: '30', date: 'Jan 15, 2026' },
    { fish: 'Tilapia',     weight: '2.3',  size: '20cm - 30cm', source: 'Lake',  location: 'Laguna de Bay',         depth: '5',  date: 'Jan 22, 2026' },
    { fish: 'Bangus',      weight: '1.8',  size: '25cm - 35cm', source: 'Sea',   location: 'Manila Bay',            depth: '10', date: 'Feb 3, 2026'  },
    { fish: 'Galunggong',  weight: '0.9',  size: '15cm - 20cm', source: 'Sea',   location: 'Batangas Bay',          depth: '20', date: 'Feb 10, 2026' },
    { fish: 'Lapu-Lapu',   weight: '3.2',  size: '30cm - 40cm', source: 'Sea',   location: 'Cebu Strait',           depth: '15', date: 'Feb 14, 2026' },
    { fish: 'Maya-Maya',   weight: '2.1',  size: '25cm - 35cm', source: 'Sea',   location: 'Palawan Waters',        depth: '25', date: 'Feb 18, 2026' },
    { fish: 'Tanigue',     weight: '5.4',  size: '50cm - 70cm', source: 'Sea',   location: 'Davao Gulf',            depth: '35', date: 'Feb 20, 2026' },
    { fish: 'Carp',        weight: '1.5',  size: '20cm - 25cm', source: 'Pond',  location: 'Candaba Swamp',         depth: '3',  date: 'Feb 22, 2026' },
    { fish: 'Catfish',     weight: '1.2',  size: '18cm - 25cm', source: 'River', location: 'Cagayan River',         depth: '4',  date: 'Feb 24, 2026' },
    { fish: 'Squid',       weight: '0.8',  size: '15cm - 20cm', source: 'Sea',   location: 'Visayan Sea',           depth: '12', date: 'Feb 25, 2026' },
];

const memberMonths = [
    'January 2025', 'February 2025', 'March 2025',
    'April 2025',   'May 2025',      'June 2025',
    'July 2025',    'August 2025',   'September 2025',
];

async function seed() {
    console.log('🌱 EcoFin Supabase Seed Starting...\n');

    let authSuccess  = 0;
    let authSkipped  = 0;
    let authFailed   = 0;
    let dbSuccess    = 0;
    let dbFailed     = 0;
    let catchSuccess = 0;

    for (const user of users) {
        console.log(`─── ${user.name} (${user.email})`);

        // ── Step 1: Create Supabase Auth account ──────────────
        const { data: authData, error: authError } =
            await supabase.auth.admin.createUser({
                email:         user.email,
                password:      PASSWORD,
                email_confirm: true,
            });

        if (authError) {
            if (authError.message.toLowerCase().includes('already')) {
                console.log(`  ⚠️  Auth: already exists`);
                authSkipped++;
            } else {
                console.error(`  ❌ Auth failed: ${authError.message}`);
                authFailed++;
            }
        } else {
            console.log(`  ✅ Auth created`);
            authSuccess++;
        }

        // ── Step 2: Insert into users table ───────────────────
        const fishing_hours = Math.floor(Math.random() * 150) + 20;
        const achievements  = Math.floor(Math.random() * 10)  + 1;
        const success_rate  = Math.floor(Math.random() * 35)  + 60;
        const member_since  = memberMonths[Math.floor(Math.random() * memberMonths.length)];

        const { error: dbError } = await supabase
            .from('users')
            .upsert({
                id:                  user.id,
                name:                user.name,
                email:               user.email,
                facebook_id:         '',
                psid:                '',
                whatsapp:            '',
                waba_id:             '',
                location:            user.location,
                total_catches:       0,
                fishing_hours,
                achievements,
                success_rate,
                member_since,
                messenger_connected: false,
                whatsapp_connected:  false,
            }, { onConflict: 'id' });

        if (dbError) {
            console.error(`  ❌ DB failed: ${dbError.message}`);
            dbFailed++;
            continue; // skip catches if user insert failed
        }

        console.log(`  ✅ DB record created`);
        dbSuccess++;

        // ── Step 3: Seed 2-4 catches per user ─────────────────
        const numCatches = Math.floor(Math.random() * 3) + 2;
        let userCatchCount = 0;

        for (let i = 0; i < numCatches; i++) {
            const c       = catchPool[(i + users.indexOf(user)) % catchPool.length];
            const catchId = `catch_${user.id}_${i + 1}`;

            const { error: catchError } = await supabase
                .from('catches')
                .upsert({
                    id:      catchId,
                    user_id: user.id,
                    fish:    c.fish,
                    weight:  c.weight,
                    size:    c.size,
                    source:  c.source,
                    location: c.location,
                    depth:   c.depth,
                    date:    c.date,
                }, { onConflict: 'id' });

            if (!catchError) {
                catchSuccess++;
                userCatchCount++;
            } else {
                console.error(`  ❌ Catch failed: ${catchError.message}`);
            }

            await new Promise(r => setTimeout(r, 60));
        }

        // ── Step 4: Update total_catches count ────────────────
        await supabase
            .from('users')
            .update({ total_catches: userCatchCount })
            .eq('id', user.id);

        console.log(`  🐟 ${userCatchCount} catches seeded\n`);
        await new Promise(r => setTimeout(r, 120));
    }

    // ── Summary ───────────────────────────────────────────────
    console.log('═══════════════════════════════════════════════');
    console.log('✅ SEED COMPLETE');
    console.log(`   Auth: ${authSuccess} created, ${authSkipped} skipped, ${authFailed} failed`);
    console.log(`   DB:   ${dbSuccess} created, ${dbFailed} failed`);
    console.log(`   Catches: ${catchSuccess} seeded`);
    console.log('═══════════════════════════════════════════════');
    console.log('\n📋 ALL 20 LOGIN CREDENTIALS:');
    console.log('   Password: EcoFin2025!\n');
    users.forEach((u, i) => {
        console.log(`   ${String(i + 1).padStart(2, '0')}. ${u.email.padEnd(28)} ${u.name}`);
    });
    console.log('\n🌐 App URL: your-railway-url.up.railway.app');
}

seed().catch(err => {
    console.error('❌ Seed crashed:', err.message);
    process.exit(1);
});