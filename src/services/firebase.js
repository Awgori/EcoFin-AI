const admin = require('firebase-admin');
const serviceAccount = require('../../firebaseKey.json');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://ecofin-ai-default-rtdb.asia-southeast1.firebasedatabase.app"
    });
}

const db = admin.database();

// ─── Save or update a user in Firebase ───────────────────────
async function saveUser(userId, userData) {
    await db.ref(`users/${userId}`).update(userData);
    console.log(`[Firebase] ✅ User saved: ${userId}`);
}

// ─── Get a user by their Messenger PSID ──────────────────────
async function getUserByPSID(psid) {
    const snapshot = await db.ref('users')
        .orderByChild('psid').equalTo(psid).once('value');
    const data = snapshot.val();
    if (!data) return null;
    const userId = Object.keys(data)[0];
    return { id: userId, ...data[userId] };
}

// ─── Get a user by their WhatsApp number ─────────────────────
async function getUserByWhatsApp(phone) {
    // Strip '+' from incoming phone (WhatsApp webhook never sends '+')
    const normalized = phone.replace(/^\+/, '');

    // Try exact match first (stored without '+')
    const snapshot = await db.ref('users')
        .orderByChild('whatsapp').equalTo(normalized).once('value');
    let data = snapshot.val();

    // If not found, try with '+' prefix (stored with '+')
    if (!data) {
        const snapshot2 = await db.ref('users')
            .orderByChild('whatsapp').equalTo('+' + normalized).once('value');
        data = snapshot2.val();
    }

    if (!data) return null;
    const userId = Object.keys(data)[0];
    return { id: userId, ...data[userId] };
}

// ─── Get all catches for a user ───────────────────────────────
async function getCatchesByUser(userId) {
    const snapshot = await db.ref(`catches/${userId}`).once('value');
    const data = snapshot.val();
    if (!data) return [];
    return Object.values(data);
}

module.exports = { saveUser, getUserByPSID, getUserByWhatsApp, getCatchesByUser, db };