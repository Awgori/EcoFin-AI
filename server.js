require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const session = require('express-session');

const webhookRoute = require('./src/routes/webhook');
const {
    saveUser,
    getUserByFacebookId,
    getCatchesByUser,
    updateUser,
    saveCatch,
    countCatches,
    deleteCatches,
    supabase
} = require('./src/services/supabase');
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
// A. Facebook OAuth — Step 1: Redirect to Facebook Login
// ─────────────────────────────────────────────────────────────

app.get('/auth/facebook', (req, res) => {
    const params = new URLSearchParams({
        client_id: process.env.APP_ID,
        redirect_uri: process.env.REDIRECT_URI,
        scope: 'public_profile',
        response_type: 'code',
    });

    res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`);
});


// ─────────────────────────────────────────────────────────────
// B. Facebook OAuth — Step 2: Callback
// ─────────────────────────────────────────────────────────────

app.get('/auth/messenger/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        console.warn('[EcoFin] ⚠️ No code received — user may have cancelled login');
        return res.redirect('/login.html?error=cancelled');
    }

    try {
        // ── Exchange code for access token ────────────────────
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

        // ── Get Facebook User ID and name ─────────────────────
        const profileRes = await axios.get('https://graph.facebook.com/me', {
            params: {
                access_token: accessToken,
                fields: 'id,name'
            }
        });
        const { id: facebookUserId, name } = profileRes.data;

        console.log(`[EcoFin] ✅ Facebook login: ${name} (${facebookUserId})`);

        // ── Try to get Messenger PSID ─────────────────────────
        let psid = '';
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
            psid = psidRes.data?.ids_for_pages?.data?.[0]?.id || '';
            if (psid) console.log(`[EcoFin] ✅ PSID retrieved: ${psid}`);
        } catch {
            console.warn('[EcoFin] ⚠️ Could not retrieve PSID');
        }

        // ── Check if user already exists in Supabase ─────────
        const existingUser = await getUserByFacebookId(facebookUserId);
        let userId;

        if (existingUser) {
            userId = existingUser.id;
            await updateUser(userId, {
                name,
                facebook_id: facebookUserId,
                psid: psid || existingUser.psid || '',
                messenger_connected: !!psid,
            });
            console.log(`[EcoFin] ✅ Existing user updated: ${userId}`);
        } else {
            userId = `fb_${facebookUserId}`;
            await saveUser(userId, {
                name,
                email: '',
                facebook_id: facebookUserId,
                psid: psid || '',
                whatsapp: '',
                location: 'Philippines',
                total_catches: 0,
                fishing_hours: 0,
                achievements: 0,
                success_rate: 0,
                member_since: new Date().toLocaleDateString('en-US', {
                    month: 'long', year: 'numeric'
                }),
                messenger_connected: !!psid,
                whatsapp_connected: false,
            });
            console.log(`[EcoFin] ✅ New user created: ${userId}`);
        }

        // ── Create session ────────────────────────────────────
        req.session.userId = userId;
        req.session.userName = name;
        req.session.loggedIn = true;

        res.redirect('/dashboard.html');

    } catch (err) {
        console.error('[EcoFin] ❌ Facebook OAuth failed:', err.response?.data || err.message);
        res.redirect('/login.html?error=failed');
    }
});


// ─────────────────────────────────────────────────────────────
// C. Connect Messenger (after already logged in)
// ─────────────────────────────────────────────────────────────

app.get('/auth/messenger', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/login.html?error=not_logged_in');

    const params = new URLSearchParams({
        client_id: process.env.APP_ID,
        redirect_uri: process.env.REDIRECT_URI,
        scope: 'public_profile',
        response_type: 'code',
        state: req.session.userId,
    });

    res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`);
});


// ─────────────────────────────────────────────────────────────
// D. WhatsApp Callback
// ─────────────────────────────────────────────────────────────

app.post('/auth/whatsapp/callback', async (req, res) => {
    const { phone, wabaId, userId, name } = req.body;
    if (!phone) return res.status(400).json({ error: 'No phone number received' });

    try {
        const targetId = userId || req.session.userId;

        if (targetId) {
            await updateUser(targetId, {
                whatsapp: phone,
                waba_id: wabaId || '',
                whatsapp_connected: true,
            });
            console.log(`[EcoFin] ✅ WhatsApp linked to ${targetId}: ${phone}`);
        } else {
            await saveUser(`wa_${phone}`, {
                name: name || 'EcoFin User',
                whatsapp: phone,
                waba_id: wabaId || '',
                whatsapp_connected: true,
                messenger_connected: false,
                total_catches: 0,
                location: 'Philippines',
                member_since: new Date().toLocaleDateString('en-US', {
                    month: 'long', year: 'numeric'
                }),
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
// E. Get Current Logged-In User
// ─────────────────────────────────────────────────────────────

app.get('/api/me', async (req, res) => {
    if (!req.session.loggedIn) return res.status(401).json({ error: 'Not logged in' });

    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.session.userId)
            .single();

        if (error || !data) return res.status(404).json({ error: 'User not found' });
        res.json({ id: req.session.userId, ...data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ─────────────────────────────────────────────────────────────
// F. Get Profile Data (by userId)
// ─────────────────────────────────────────────────────────────

app.get('/api/profile/:userId', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.params.userId)
            .single();

        if (error || !data) return res.status(404).json({ error: 'User not found' });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ─────────────────────────────────────────────────────────────
// G. Get Catches for Logged-In User
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
// H. Get Catches by userId (generic)
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
// I. Submit New Catch
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
        await saveCatch(req.session.userId, catchId, catchData);

        const realCount = await countCatches(req.session.userId);
        await updateUser(req.session.userId, { total_catches: realCount });

        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.session.userId)
            .single();

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
// J. Clear All Catches for Logged-In User
// ─────────────────────────────────────────────────────────────

app.delete('/api/clear-catches', async (req, res) => {
    if (!req.session.loggedIn) return res.status(401).json({ error: 'Not logged in' });

    try {
        await deleteCatches(req.session.userId);
        await updateUser(req.session.userId, { total_catches: 0 });

        console.log(`[EcoFin] 🗑️ Catches cleared for ${req.session.userId}`);
        res.json({ success: true, message: 'Catch history cleared.' });
    } catch (err) {
        console.error('[EcoFin] ❌ Clear catches failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});


// ─────────────────────────────────────────────────────────────
// L. Update Profile (name + email)
// ─────────────────────────────────────────────────────────────

app.post('/api/update-profile', async (req, res) => {
    if (!req.session.loggedIn) return res.status(401).json({ error: 'Not logged in' });

    try {
        const { name, email } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        await updateUser(req.session.userId, { name, email: email || '' });
        req.session.userName = name;

        console.log(`[EcoFin] ✅ Profile updated for ${req.session.userId}`);
        res.json({ success: true });
    } catch (err) {
        console.error('[EcoFin] ❌ Profile update failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});


// ─────────────────────────────────────────────────────────────
// K. Logout
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