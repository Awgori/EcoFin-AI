require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const session = require('express-session');

const webhookRoute = require('./src/routes/webhook');
const { saveUser, db, getCatchesByUser } = require('./src/services/firebase');
const { handleSystemMessage } = require('./src/services/messengerService');

const app = express();

app.use(bodyParser.json());
app.use(express.static(__dirname));

// ─── Session Middleware ───────────────────────────────────────
app.use(session({
    secret: 'ecofin-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use('/webhook', webhookRoute);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});


// ─────────────────────────────────────────────────────────────
// FACEBOOK LOGIN — Demo bypass
// ─────────────────────────────────────────────────────────────

app.get('/auth/facebook', async (req, res) => {
    try {
        const snapshot = await db.ref('users/user_001').once('value');
        const user = snapshot.val();
        if (!user) return res.redirect('/login.html?error=not_found');

        req.session.userId = 'user_001';
        req.session.userName = user.name;
        req.session.loggedIn = true;

        console.log(`[EcoFin] ✅ Demo login as: ${user.name}`);
        res.redirect('/dashboard.html');
    } catch (err) {
        console.error('[EcoFin] ❌ Demo login failed:', err.message);
        res.redirect('/login.html?error=failed');
    }
});


// ─────────────────────────────────────────────────────────────
// A. Messenger OAuth — Step 1: Redirect to Facebook Login
// ─────────────────────────────────────────────────────────────

app.get('/auth/messenger', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/login.html?error=not_logged_in');

    const params = new URLSearchParams({
        client_id: process.env.APP_ID,
        redirect_uri: process.env.REDIRECT_URI,
        scope: 'pages_messaging,pages_show_list',
        response_type: 'code',
        state: req.session.userId,
    });

    res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`);
});


// ─────────────────────────────────────────────────────────────
// A. Messenger OAuth — Step 2: Callback, retrieve PSID
// ─────────────────────────────────────────────────────────────

app.get('/auth/messenger/callback', async (req, res) => {
    const code = req.query.code;
    const userId = req.query.state;

    if (!code) return res.redirect('/dashboard.html?error=no_code');

    try {
        // Exchange code for access token
        const tokenRes = await axios.get(
            'https://graph.facebook.com/v19.0/oauth/access_token',
            {
                params: {
                    client_id: process.env.APP_ID,
                    client_secret: process.env.APP_SECRET,
                    redirect_uri: process.env.REDIRECT_URI,
                    code,
                }
            }
        );
        const accessToken = tokenRes.data.access_token;

        // Get Facebook User ID and name
        const profileRes = await axios.get('https://graph.facebook.com/me', {
            params: { access_token: accessToken, fields: 'id,name' }
        });
        const { id: facebookUserId, name } = profileRes.data;

        // Retrieve Messenger PSID
        let psid = facebookUserId;
        try {
            const psidRes = await axios.get(
                `https://graph.facebook.com/v19.0/${facebookUserId}`,
                {
                    params: {
                        fields: 'ids_for_pages',
                        access_token: process.env.PAGE_ACCESS_TOKEN,
                    }
                }
            );
            psid = psidRes.data?.ids_for_pages?.data?.[0]?.id || facebookUserId;
        } catch {
            console.warn('[EcoFin] Could not get PSID, using Facebook ID as fallback');
        }

        // Link PSID to existing user or create new
        if (userId) {
            await db.ref(`users/${userId}`).update({
                psid,
                facebookId: facebookUserId,
                messengerConnected: true,
            });
            console.log(`[EcoFin] ✅ Messenger linked for ${userId} | PSID: ${psid}`);
        } else {
            const snapshot = await db.ref('users')
                .orderByChild('facebookId').equalTo(facebookUserId).once('value');
            let userData = snapshot.val();

            if (userData) {
                const existingId = Object.keys(userData)[0];
                await db.ref(`users/${existingId}`).update({ psid, messengerConnected: true });
            } else {
                await saveUser(`fb_${facebookUserId}`, {
                    name,
                    email: '',
                    facebookId: facebookUserId,
                    psid,
                    location: 'Philippines',
                    totalCatches: 0,
                    fishingHours: 0,
                    achievements: 0,
                    successRate: 0,
                    memberSince: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                    messengerConnected: true,
                    whatsappConnected: false,
                });
            }
        }

        res.redirect('/dashboard.html?messenger=connected');

    } catch (err) {
        console.error('[EcoFin] ❌ Messenger auth failed:', err.response?.data || err.message);
        res.redirect('/dashboard.html?error=messenger_failed');
    }
});


// ─────────────────────────────────────────────────────────────
// B. WhatsApp Embedded Signup — Callback
// Phone number comes from Meta, user never types it
// ─────────────────────────────────────────────────────────────

app.post('/auth/whatsapp/callback', async (req, res) => {
    const { phone, wabaId, userId, name } = req.body;
    if (!phone) return res.status(400).json({ error: 'No phone number received' });

    try {
        const targetId = userId || req.session.userId;

        if (targetId) {
            // Link WhatsApp to existing user
            await db.ref(`users/${targetId}`).update({
                whatsapp: phone,
                wabaId: wabaId || '',
                whatsappConnected: true,
            });
            console.log(`[EcoFin] ✅ WhatsApp linked to ${targetId}: ${phone}`);
        } else {
            // Create new user from WhatsApp signup
            await saveUser(`wa_${phone}`, {
                name: name || 'EcoFin User',
                whatsapp: phone,
                wabaId: wabaId || '',
                whatsappConnected: true,
                messengerConnected: false,
                totalCatches: 0,
                location: 'Philippines',
                memberSince: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            });
            console.log(`[EcoFin] ✅ New WhatsApp user created: ${phone}`);
        }

        res.json({ success: true, phone });
    } catch (err) {
        console.error('[EcoFin] ❌ WhatsApp auth failed:', err.message);
        res.status(500).json({ error: 'Failed to save WhatsApp data' });
    }
});


// ─────────────────────────────────────────────────────────────
// C. Get Current Logged-In User
// ─────────────────────────────────────────────────────────────

app.get('/api/me', async (req, res) => {
    if (!req.session.loggedIn) return res.status(401).json({ error: 'Not logged in' });

    try {
        const snapshot = await db.ref(`users/${req.session.userId}`).once('value');
        const user = snapshot.val();
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ id: req.session.userId, ...user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ─────────────────────────────────────────────────────────────
// D. Get Profile Data (by userId)
// ─────────────────────────────────────────────────────────────

app.get('/api/profile/:userId', async (req, res) => {
    try {
        const snapshot = await db.ref(`users/${req.params.userId}`).once('value');
        const user = snapshot.val();
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ─────────────────────────────────────────────────────────────
// E. Get Catches for Logged-In User
// ─────────────────────────────────────────────────────────────

app.get('/api/my-catches', async (req, res) => {
    if (!req.session.loggedIn) return res.status(401).json({ error: 'Not logged in' });

    try {
        const catches = await getCatchesByUser(req.session.userId);
        res.json(catches);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ─────────────────────────────────────────────────────────────
// F. Get Catches by userId (generic)
// ─────────────────────────────────────────────────────────────

app.get('/api/catches/:userId', async (req, res) => {
    try {
        const catches = await getCatchesByUser(req.params.userId);
        res.json(catches);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ─────────────────────────────────────────────────────────────
// G. Submit New Catch
// ─────────────────────────────────────────────────────────────

app.post('/api/log-catch', async (req, res) => {
    if (!req.session.loggedIn) return res.status(401).json({ error: 'Not logged in' });

    try {
        const catchData = {
            fish: req.body.fish,
            weight: req.body.weight,
            size: req.body.size,
            location: req.body.location,
            source: req.body.source,
            depth: req.body.depth,
            date: new Date().toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            }),
        };

        const catchId = `catch_${Date.now()}`;
        await db.ref(`catches/${req.session.userId}/${catchId}`).set(catchData);

        // Count real catches — never drifts
        const catchesSnap = await db.ref(`catches/${req.session.userId}`).once('value');
        const realCount = catchesSnap.val() ? Object.keys(catchesSnap.val()).length : 0;

        const userSnap = await db.ref(`users/${req.session.userId}`).once('value');
        const user = userSnap.val();

        await db.ref(`users/${req.session.userId}`).update({ totalCatches: realCount });

        // Send alert with full catch details to Messenger and/or WhatsApp
        if (user.psid) await handleSystemMessage(user.psid, 'catch', catchData, user);
        if (user.whatsapp) await handleSystemMessage(user.whatsapp, 'catch', catchData, user);

        console.log(`[EcoFin] ✅ Catch logged for ${user.name} (total: ${realCount})`);
        res.json({ success: true, message: 'Catch logged and alerts sent!' });

    } catch (err) {
        console.error('[EcoFin] ❌ Log catch failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});


// ─────────────────────────────────────────────────────────────
// H. Clear All Catches for Logged-In User
// ─────────────────────────────────────────────────────────────

app.delete('/api/clear-catches', async (req, res) => {
    if (!req.session.loggedIn) return res.status(401).json({ error: 'Not logged in' });

    try {
        await db.ref(`catches/${req.session.userId}`).remove();
        await db.ref(`users/${req.session.userId}`).update({ totalCatches: 0 });

        console.log(`[EcoFin] 🗑️ Catches cleared for ${req.session.userId}`);
        res.json({ success: true, message: 'Catch history cleared.' });
    } catch (err) {
        console.error('[EcoFin] ❌ Clear catches failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});


// ─────────────────────────────────────────────────────────────
// I. Logout
// ─────────────────────────────────────────────────────────────

app.get('/auth/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login.html');
});


// ─────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`[EcoFin] Server running → http://localhost:${PORT}`);
});