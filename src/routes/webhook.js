const express = require("express");
const router = express.Router();

const {
    sendMessengerMessage,
    handleMessengerOnly,
    sendWhatsAppMenu,
    handleWhatsAppOnly,
} = require("../services/messengerService");

// Prevent double-sends
const processedEvents = new Set();

function isDuplicate(id) {
    if (processedEvents.has(id)) return true;
    processedEvents.add(id);
    if (processedEvents.size > 1000) processedEvents.clear();
    return false;
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

                            // Any greeting → send the interactive menu automatically
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
                                    // Unrecognised message → show the menu anyway
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