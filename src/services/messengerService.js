const axios = require('axios');
const { getUserByPSID, getUserByWhatsApp, getCatchesByUser, supabase } = require('./supabase');

// ─── Send via Messenger ───────────────────────────────────────
async function sendMessengerMessage(psid, message) {
    try {
        const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`;
        if (typeof message === 'string') message = { text: message };
        await axios.post(url, { recipient: { id: psid }, message });
        console.log(`[EcoFin] ✅ Messenger sent to: ${psid}`);
    } catch (err) {
        console.error('[EcoFin] ❌ Messenger send failed:', err.message);
    }
}

// ─── Send via WhatsApp (plain text) ──────────────────────────
async function sendWhatsAppMessage(phone, message) {
    try {
        const url = `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`;
        if (typeof message === 'string') message = { body: message };
        await axios.post(url, {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: message.body || message.text || '' },
        }, {
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[EcoFin] ✅ WhatsApp sent to: ${phone}`);
    } catch (err) {
        console.error('[EcoFin] ❌ WhatsApp send failed:', err.message);
    }
}

// ─── Send WhatsApp interactive menu ──────────────────────────
// This replaces sendWhatsAppMenu.js — no need to node the file anymore.
// Called automatically by webhook when user sends any greeting.
async function sendWhatsAppMenu(phone) {
    try {
        const url = `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`;
        await axios.post(url, {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: { type: 'text', text: '🐟 EcoFin AI' },
                body: { text: 'Hi! Welcome to EcoFin 🎣\nPlease let us know how we can help you.' },
                footer: { text: 'Smarter Fisheries, Greener Future' },
                action: {
                    button: 'Main Menu',
                    sections: [{
                        title: 'Fisher Options',
                        rows: [
                            {
                                id: 'MENU_PROFILE',
                                title: '🧑 View My Profile',
                                description: 'See your fisher profile and stats'
                            },
                            {
                                id: 'MENU_CATCH',
                                title: '🐟 Latest Catch',
                                description: 'View your most recent catch'
                            },
                            {
                                id: 'MENU_HISTORY',
                                title: '📋 Catch History',
                                description: 'See all your logged catches'
                            },
                        ]
                    }]
                }
            }
        }, {
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[EcoFin] ✅ WhatsApp menu sent to: ${phone}`);
    } catch (err) {
        console.error('[EcoFin] ❌ WhatsApp menu failed:', err.response?.data || err.message);
    }
}

// ─── Formatters ───────────────────────────────────────────────
function formatProfile(user, catches) {
    return `👤 ${user.name}\nLocation: ${user.location}\nCatches: ${catches.length}`;
}

function formatCatchAlert(catchRecord, user) {
    const location = catchRecord.location || 'Unknown';
    const source = catchRecord.source || '--';
    const depth = catchRecord.depth ? `${catchRecord.depth} m` : '--';
    const weight = catchRecord.weight ? `${catchRecord.weight} kg` : '--';

    return (
        `🐟 New Catch Logged — EcoFin AI\n` +
        `─────────────────────────────\n` +
        `Fisher:   ${user.name}\n` +
        `Fish:     ${catchRecord.fish}\n` +
        `Weight:   ${weight}\n` +
        `Size:     ${catchRecord.size}\n` +
        `Source:   ${source}\n` +
        `Location: ${location}\n` +
        `Depth:    ${depth}\n` +
        `Date:     ${catchRecord.date}\n` +
        `─────────────────────────────\n` +
        `View full history in the EcoFin app.`
    );
}

function formatHistoryFromArray(catches, user) {
    if (!catches.length) return '📋 No catches logged yet.';

    const lines = catches.map((c, i) => {
        const weight = c.weight ? `${c.weight} kg` : '--';
        return (
            `#${i + 1} ${c.fish} — ${weight} (${c.size})\n` +
            `    📍 ${c.location || 'Unknown'} | 🗓️ ${c.date}`
        );
    });

    return (
        `📋 Catch History — ${user.name}\n` +
        `─────────────────────────────\n` +
        lines.join('\n\n') +
        `\n─────────────────────────────\n` +
        `Total: ${catches.length} catch${catches.length !== 1 ? 'es' : ''}`
    );
}

// ─── Handle Messenger Postback ────────────────────────────────
async function handleMessengerOnly(psid, action) {
    const user = await getUserByPSID(psid);
    if (!user) return console.log(`[EcoFin] Unknown PSID: ${psid}`);

    let message = '';

    if (action === 'profile') {
        const catches = await getCatchesByUser(user.id);
        await db.ref(`users/${user.id}`).update({ totalCatches: catches.length });
        message = formatProfile(user, catches);
    } else if (action === 'history') {
        const catches = await getCatchesByUser(user.id);
        message = formatHistoryFromArray(catches, user);
    } else {
        const catches = await getCatchesByUser(user.id);
        const latest = catches[catches.length - 1];
        message = latest ? formatCatchAlert(latest, user) : '🎣 No catches logged yet.';
    }

    await sendMessengerMessage(psid, message);
}

// ─── Handle WhatsApp Menu Selection ──────────────────────────
async function handleWhatsAppOnly(phone, action) {
    const user = await getUserByWhatsApp(phone);

    // User not found — prompt to connect their account
    if (!user) {
        await sendWhatsAppMessage(phone,
            `⚠️ Your WhatsApp number is not linked to an EcoFin account yet.\n` +
            `Please log in to the EcoFin app and connect your WhatsApp from your profile.`
        );
        return;
    }

    let message = '';

    if (action === 'profile') {
        const catches = await getCatchesByUser(user.id);
        await db.ref(`users/${user.id}`).update({ totalCatches: catches.length });
        message = formatProfile(user, catches);
    } else if (action === 'history') {
        const catches = await getCatchesByUser(user.id);
        message = formatHistoryFromArray(catches, user);
    } else {
        const catches = await getCatchesByUser(user.id);
        const latest = catches[catches.length - 1];
        message = latest ? formatCatchAlert(latest, user) : '🎣 No catches logged yet.';
    }

    await sendWhatsAppMessage(phone, message);
}

// ─── System Alert (after logging a catch) ────────────────────
async function handleSystemMessage(recipient, event, catchData, user) {
    if (event !== 'catch') return;

    const msg = formatCatchAlert(catchData, user);

    const waUser = await getUserByWhatsApp(recipient).catch(() => null);
    if (waUser) {
        await sendWhatsAppMessage(recipient, msg);
    } else {
        const msUser = await getUserByPSID(recipient).catch(() => null);
        if (msUser) {
            await sendMessengerMessage(recipient, msg);
        }
    }
}

module.exports = {
    sendMessengerMessage,
    sendWhatsAppMessage,
    sendWhatsAppMenu,
    handleMessengerOnly,
    handleWhatsAppOnly,
    handleSystemMessage,
};