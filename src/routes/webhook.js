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
async function savePSIDIfNeeded(psid) {
    try {
        // Check if any user has this PSID already
        const { data: existing } = await supabase
            .from('users')
            .select('id, psid')
            .eq('psid', psid)
            .single();

        if (existing) return; // Already saved

        // Try to find user by facebook_id matching psid (fallback)
        const { data: fbUser } = await supabase
            .from('users')
            .select('id, psid, facebook_id')
            .eq('facebook_id', psid)
            .single();

        if (fbUser) {
            // Update the user with correct PSID
            await supabase
                .from('users')
                .update({ psid, messenger_connected: true })
                .eq('id', fbUser.id);
            console.log(`[EcoFin] ✅ PSID auto-saved for user: ${fbUser.id}`);
            return;
        }

        // Find user with facebook_id set but no psid yet
        const { data: unlinkedUser } = await supabase
            .from('users')
            .select('id, psid, facebook_id, messenger_connected')
            .not('facebook_id', 'is', null)
            .is('psid', null)
            .single();

        if (unlinkedUser) {
            await supabase
                .from('users')
                .update({ psid, messenger_connected: true })
                .eq('id', unlinkedUser.id);
            console.log(`[EcoFin] ✅ PSID auto-saved for unlinked user: ${unlinkedUser.id}`);
        }
    } catch (err) {
        // Silently ignore — PSID save is best-effort
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

                    // ── Auto-save PSID on every message ───────
                    await savePSIDIfNeeded(senderId);

                    // ── Text Messages ──────────────────────────
                    if (event.message && event.message.mid) {
                        if (isDuplicate(event.message.mid)) continue;

                        const text = event.message.text?.toLowerCase() || "";
                        if (text === "hi" || text === "hello" || text === "start") {
                            await sendMainMenu(senderId);
                        }
                    }

                    // ── Postbacks (Button Clicks) ──────────────
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

                        // ── Text message ──────────────────────
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

                        // ── Interactive list reply (menu selection) ──
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

                        // ── Any other message type → show menu ─
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
                    { type: "postback", title: "🐟 Latest Catch", payload: "LATEST_CATCH" },
                    { type: "postback", title: "📋 Catch History", payload: "CATCH_HISTORY" }
                ]
            }
        }
    };
    await sendMessengerMessage(psid, message);
}

module.exports = router;