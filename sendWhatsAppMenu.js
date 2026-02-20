// sendWhatsAppMenu.js — Run once to test the WhatsApp menu
// Command: node sendWhatsAppMenu.js
require('dotenv').config();
const axios = require('axios');

async function sendMenu(phone) {
    const url = `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`;
    try {
        await axios.post(url, {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: { type: 'text', text: '🐟 EcoFin AI' },
                body: { text: 'Hi! Please let us know how we can help you.' },
                footer: { text: 'Smarter Fisheries, Greener Future' },
                action: {
                    button: 'Main Menu',
                    sections: [{
                        title: 'Fisher Options',
                        rows: [
                            {
                                id: 'MENU_PROFILE', title: '🧑 View My Profile',
                                description: 'See your fisher profile and stats'
                            },
                            {
                                id: 'MENU_CATCH', title: '🐟 Latest Catch',
                                description: 'View your most recent catch'
                            },
                            {
                                id: 'MENU_HISTORY', title: '📋 Catch History',
                                description: 'See all your logged catches'
                            },
                        ]
                    }]
                }
            }
        }, {
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json',
            }
        });
        console.log(`✅ WhatsApp menu sent to ${phone}`);
    } catch (err) {
        console.error('❌ Failed:', JSON.stringify(err.response?.data, null, 2));
    }
}

// Replace with your actual WhatsApp number (include country code)
sendMenu('+639690901019');
