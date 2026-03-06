const express = require("express");
const router = express.Router();

const {
    sendMessengerMessage,
    handleMessengerOnly,
    sendWhatsAppMenu,
    handleWhatsAppOnly,
} = require("../services/messengerService");

const { supabase } = require("../services/supabase");

// Prevent double-sends
const processedEvents = new Set();

function isDuplicate(id) {
    if (processedEvents.has(id)) return true;
    processedEvents.add(id);
    if (processedEvents.size > 1000) processedEvents.clear();
    return false;
}

// ─── Auto-save PSID when user messages the page ───────────────
// When a user messages the Facebook page, their real page-scoped PSID
// arrives here. We match them to a user record by facebook_id or by
// an old/wrong PSID and overwrite it with the real one.
async function savePSIDIfNeeded(psid) {
    try {
        // 1. Already correctly saved?
        const { data: existing } = await supabase
            .from('users')
            .select('id, psid')
            .eq('psid', psid)
            .single();

        if (existing) return; // Already linked, nothing to do

        // 2. Find any user that has a facebook_id but wrong/missing PSID
        //    (We stored facebookUserId as PSID fallback — now replace it)
        const { data: allFbUsers } = await supabase
            .from('users')
            .select('id, psid, facebook_id, messenger_connected')
            .not('facebook_id', 'is', null);

        if (allFbUsers && allFbUsers.length > 0) {
            // Prefer users with no PSID first, then users whose PSID
            // looks like a facebook_id (wrong fallback)
            const target =
                allFbUsers.find(u => !u.psid) ||
                allFbUsers.find(u => u.psid === u.facebook_id);

            if (target) {
                await supabase
                    .from('users')
                    .update({ psid, messenger_connected: true })
                    .eq('id', target.id);
                console.log(`[EcoFin] ✅ Real PSID ${psid} saved for user: ${target.id}`);
                return;
            }
        }

        console.log(`[EcoFin] ℹ️ Could not match PSID ${psid} to any user`);
    } catch (err) {
        console.error('[EcoFin] savePSIDIfNeeded error:', err.message);
    }
}

// ─── Verify Webhook ───────────────────────────────────────────
router.get("/", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token === process.env.VERIFY_TOKEN) {
        console.log("[EcoFin] Webhook verified");
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

// ─── Receive Events ───────────────────────────────────────────
router.post("/", async (req, res) => {

    // Respond immediately — prevents Meta retries / double sends
    res.sendStatus(200);

    try {
        const body = req.body;

        // ══════════════════════════════════════════════
        // MESSENGER EVENTS
        // ══════════════════════════════════════════════
        if (body.object === "page") {
            for (const entry of body.entry) {
                for (const event of entry.messaging) {

                    const senderId = event.sender.id;

                    // ── Auto-save real PSID on every message ──────────
                    await savePSIDIfNeeded(senderId);

                    // ── Text Messages ──────────────────────────────────
                    if (event.message && event.message.mid) {
                        if (isDuplicate(event.message.mid)) continue;

                        const text = event.message.text?.toLowerCase() || "";
                        if (text === "hi" || text === "hello" || text === "start") {
                            await sendMainMenu(senderId);
                        }
                    }

                    // ── Postbacks (Button Clicks) ──────────────────────
                    if (event.postback) {
                        const postbackId = `${senderId}_${event.postback.payload}_${event.timestamp}`;
                        if (isDuplicate(postbackId)) continue;

                        const payload = event.postback.payload;
                        console.log("[EcoFin] Messenger postback:", payload);

                        switch (payload) {
                            case "GET_STARTED":
                                await sendMainMenu(senderId);
                                break;
                            case "VIEW_PROFILE":
                                await handleMessengerOnly(senderId, "profile");
                                break;
                            case "LATEST_CATCH":
                                await handleMessengerOnly(senderId, "latest");
                                break;
                            case "CATCH_HISTORY":
                                await handleMessengerOnly(senderId, "history");
                                break;
                            default:
                                console.log("[EcoFin] Unhandled Messenger postback:", payload);
                        }
                    }
                }
            }
        }

        // ══════════════════════════════════════════════
        // WHATSAPP EVENTS
        // ══════════════════════════════════════════════
        if (body.object === "whatsapp_business_account") {
            for (const entry of body.entry) {
                for (const change of entry.changes) {

                    const value = change.value;
                    const messages = value?.messages;
                    if (!messages) continue;

                    for (const msg of messages) {
                        const phone = msg.from;
                        const msgId = msg.id;

                        if (isDuplicate(msgId)) {
                            console.log("[EcoFin] Duplicate WA message skipped:", msgId);
                            continue;
                        }

                        console.log("[EcoFin] WhatsApp from:", phone, "| type:", msg.type);

                        // ── Text message ──────────────────────────────
                        if (msg.type === "text") {
                            const text = msg.text?.body?.toLowerCase() || "";

                            if (
                                text === "hi" || text === "hello" ||
                                text === "start" || text === "menu" ||
                                text === "help"
                            ) {
                                await sendWhatsAppMenu(phone);
                            }
                        }

                        // ── Interactive list reply (menu selection) ───
                        if (msg.type === "interactive") {
                            const listReply = msg.interactive?.list_reply;
                            const btnReply = msg.interactive?.button_reply;

                            const selectedId = listReply?.id || btnReply?.id || "";
                            console.log("[EcoFin] WhatsApp menu selection:", selectedId);

                            switch (selectedId) {
                                case "MENU_PROFILE":
                                    await handleWhatsAppOnly(phone, "profile");
                                    break;
                                case "MENU_CATCH":
                                    await handleWhatsAppOnly(phone, "latest");
                                    break;
                                case "MENU_HISTORY":
                                    await handleWhatsAppOnly(phone, "history");
                                    break;
                                default:
                                    console.log("[EcoFin] Unhandled WA selection:", selectedId);
                                    await sendWhatsAppMenu(phone);
                            }
                        }

                        // ── Any other message type → show menu ────────
                        if (msg.type !== "text" && msg.type !== "interactive") {
                            await sendWhatsAppMenu(phone);
                        }
                    }
                }
            }
        }

    } catch (err) {
        console.error("[EcoFin] Webhook error:", err);
    }
});

// ─── Messenger Main Menu ──────────────────────────────────────
async function sendMainMenu(psid) {
    const message = {
        attachment: {
            type: "template",
            payload: {
                template_type: "button",
                text: "Hi! Welcome to EcoFin 🎣 How can we help you?",
                buttons: [
                    { type: "postback", title: "🧑 View My Profile", payload: "VIEW_PROFILE" },
                    { type: "postback", title: "🐟 Latest Catch",    payload: "LATEST_CATCH" },
                    { type: "postback", title: "📋 Catch History",   payload: "CATCH_HISTORY" }
                ]
            }
        }
    };
    await sendMessengerMessage(psid, message);
}

module.exports = router;