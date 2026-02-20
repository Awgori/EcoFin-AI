// fixCatchCount.js — Run ONCE with: node fixCatchCount.js
require('dotenv').config();
const { db } = require('./src/services/firebase');

async function fixCatchCounts() {
    try {
        const usersSnap = await db.ref('users').once('value');
        const users = usersSnap.val();
        if (!users) return console.log('No users found.');

        for (const [userId, user] of Object.entries(users)) {
            const catchesSnap = await db.ref(`catches/${userId}`).once('value');
            const catches = catchesSnap.val();
            const realCount = catches ? Object.keys(catches).length : 0;
            await db.ref(`users/${userId}`).update({ totalCatches: realCount });
            console.log(`✅ ${user.name || userId}: ${user.totalCatches ?? '?'} → ${realCount}`);
        }

        console.log('\n✅ All catch counts corrected.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

fixCatchCounts();