const axios = require('axios');
const { getUserByPSID, getUserByWhatsApp, getCatchesByUser, updateUser } = require('./supabase');

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
            to:   phone,
            type: 'text',
            text: { body: message.body || message.text || '' },
        }, {
            headers: {
                Authorization:  `Bearer ${process.env.WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[EcoFin] ✅ WhatsApp sent to: ${phone}`);
    } catch (err) {
        console.error('[EcoFin] ❌ WhatsApp send failed:', err.message);
    }
}

// ─── Send WhatsApp interactive menu ──────────────────────────
async function sendWhatsAppMenu(phone) {
    try {
        const url = `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`;
        await axios.post(url, {
            messaging_product: 'whatsapp',
            to:   phone,
            type: 'interactive',
            interactive: {
                type:   'list',
                header: { type: 'text', text: '🐟 EcoFin AI' },
                body:   { text: 'Hi! Welcome to EcoFin 🎣\nPlease let us know how we can help you.' },
                footer: { text: 'Smarter Fisheries, Greener Future' },
                action: {
                    button: 'Main Menu',
                    sections: [{
                        title: 'Fisher Options',
                        rows: [
                            { id: 'MENU_PROFILE', title: '🧑 View My Profile', description: 'See your fisher profile and stats' },
                            { id: 'MENU_CATCH',   title: '🐟 Latest Catch',    description: 'View your most recent catch'      },
                            { id: 'MENU_HISTORY', title: '📋 Catch History',   description: 'See all your logged catches'      },
                        ]
                    }]
                }
            }
        }, {
            headers: {
                Authorization:  `Bearer ${process.env.WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[EcoFin] ✅ WhatsApp menu sent to: ${phone}`);
    } catch (err) {
        console.error('[EcoFin] ❌ WhatsApp menu failed:', err.response?.data || err.message);
    }
}

// ─── Send Messenger welcome buttons ──────────────────────────
async function sendWelcomeButtons(psid) {
    try {
        const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`;
        await axios.post(url, {
            recipient: { id: psid },
            message: {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'button',
                        text: 'Hi! Please let us know how we can help you.',
                        buttons: [
                            { type: 'postback', title: '🧑 View My Profile', payload: 'MENU_PROFILE' },
                            { type: 'postback', title: '🐟 Latest Catch',    payload: 'MENU_CATCH'   },
                            { type: 'postback', title: '📋 Catch History',   payload: 'MENU_HISTORY' },
                        ],
                    },
                },
            },
        }, { headers: { 'Content-Type': 'application/json' } });
        console.log(`[EcoFin] ✅ Welcome buttons sent to: ${psid}`);
    } catch (err) {
        console.error('[EcoFin] ❌ Welcome buttons failed:', err.response?.data || err.message);
    }
}

// ─── Formatters ───────────────────────────────────────────────
function formatProfile(user, catches) {
    return [
        `👤 EcoFin AI — Fisher Profile`,
        `─────────────────────────────`,
        `Name:          ${user.name}`,
        `Location:      ${user.location || 'Philippines'}`,
        `Total Catches: ${catches.length}`,
        `Success Rate:  ${user.success_rate || 0}%`,
        `Achievements:  ${user.achievements || 0}`,
        `Member Since:  ${user.member_since || '--'}`,
        `─────────────────────────────`,
    ].join('\n');
}

function formatCatchAlert(catchRecord, user) {
    return [
        `🐟 New Catch Logged — EcoFin AI`,
        `─────────────────────────────`,
        `Fisher:   ${user.name}`,
        `Fish:     ${catchRecord.fish}`,
        `Weight:   ${catchRecord.weight || '--'}`,
        `Size:     ${catchRecord.size || '--'}`,
        `Source:   ${catchRecord.source || '--'}`,
        `Location: ${catchRecord.location || '--'}`,
        `Depth:    ${catchRecord.depth || '--'}`,
        `Date:     ${catchRecord.date}`,
        `─────────────────────────────`,
        `View full history in the EcoFin app.`,
    ].join('\n');
}

function formatHistoryFromArray(catches, user) {
    if (!catches.length) return '📋 No catches logged yet.';

    const lines = catches.map((c, i) =>
        `#${i + 1} ${c.fish} — ${c.weight || '--'} (${c.size || '--'})\n` +
        `    📍 ${c.location || 'Unknown'} | 🗓️ ${c.date}`
    );

    return [
        `📋 Catch History — ${user.name}`,
        `─────────────────────────────`,
        ...lines,
        `─────────────────────────────`,
        `Total: ${catches.length} catch${catches.length !== 1 ? 'es' : ''}`,
    ].join('\n');
}

// ─── Build message based on action ───────────────────────────
async function buildMessage(user, action) {
    const catches = await getCatchesByUser(user.id);

    if (action === 'profile') {
        // Update total catches count in Supabase
        await updateUser(user.id, { total_catches: catches.length });
        return formatProfile(user, catches);
    } else if (action === 'history') {
        return formatHistoryFromArray(catches, user);
    } else {
        const latest = catches[catches.length - 1];
        return latest ? formatCatchAlert(latest, user) : '🎣 No catches logged yet.';
    }
}

// ─── Handle Messenger ONLY ────────────────────────────────────
async function handleMessengerOnly(psid, action) {
    const user = await getUserByPSID(psid);
    if (!user) {
        console.log(`[EcoFin] Unknown PSID: ${psid}`);
        return;
    }
    console.log(`[EcoFin] → Messenger: ${action} for ${user.name}`);
    const message = await buildMessage(user, action);
    await sendMessengerMessage(psid, message);
}

// ─── Handle WhatsApp ONLY ─────────────────────────────────────
async function handleWhatsAppOnly(phone, action) {
    const user = await getUserByWhatsApp(phone);
    if (!user) {
        console.log(`[EcoFin] Unknown WhatsApp: ${phone}`);
        await sendWhatsAppMessage(phone,
            `⚠️ Your WhatsApp number is not linked to an EcoFin account.\n` +
            `Please log in to the EcoFin app and connect your WhatsApp from your profile.`
        );
        return;
    }
    console.log(`[EcoFin] → WhatsApp: ${action} for ${user.name}`);
    const message = await buildMessage(user, action);
    await sendWhatsAppMessage(phone, message);
}

// ─── System alert — after logging a catch from the app ───────
async function handleSystemMessage(recipient, event, catchData, user) {
    if (event !== 'catch') return;
    const msg = formatCatchAlert(catchData, user);

    // Check WhatsApp first
    const waUser = await getUserByWhatsApp(recipient).catch(() => null);
    if (waUser) {
        await sendWhatsAppMessage(recipient, msg);
        return; // ← stop here, don't also send Messenger
    }

    // Then check Messenger
    const msUser = await getUserByPSID(recipient).catch(() => null);
    if (msUser) {
        await sendMessengerMessage(recipient, msg);
    }
}

module.exports = {
    sendMessengerMessage,
    sendWhatsAppMessage,
    sendWhatsAppMenu,
    sendWelcomeButtons,
    handleMessengerOnly,
    handleWhatsAppOnly,
    handleSystemMessage,
};