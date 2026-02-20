# 🦈 EcoFin - AI
### Smarter Fisheries, Greener Future

EcoFin is a mobile-first web application for Filipino fishers. It enables real-time catch logging with GPS, live weather and fishing condition forecasting, catch history management, and automated notifications via Facebook Messenger and WhatsApp.

---

## 📱 Features

- **Dashboard** — Live weather, sea condition warnings (Safe / Moderate / Danger), and catch summary
- **Log Catch** — Log catches with species, weight, size, source, and GPS location via interactive map
- **Catch History** — Searchable and filterable list of all logged catches
- **Weather & Forecast** — Real-time weather and hourly fishing quality ratings (Excellent / Good / Fair / Poor)
- **Messenger Notifications** — Automated catch summaries sent via Facebook Messenger
- **WhatsApp Notifications** — Catch summaries sent via WhatsApp Cloud API
- **Facebook Login** — Secure OAuth authentication via Facebook

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| HTML / CSS / JavaScript | UI and page logic (no framework) |
| Leaflet.js | Interactive GPS map on Log Catch |
| Open-Meteo API | Free weather and forecast data |
| Nominatim (OpenStreetMap) | Reverse geocoding GPS to city name |
| Firebase Web SDK v9 | Direct Firestore reads/writes from browser |
| Font Awesome | Icons |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | HTTP server and routing |
| express-session | Server-side session management |
| Firebase Admin SDK | Trusted Firestore access from server |
| Meta Graph API | Facebook OAuth + Messenger send API |
| WhatsApp Cloud API | WhatsApp message delivery |
| dotenv | Environment variable management |

### Database
| Service | Purpose |
|---|---|
| Firebase Firestore | Users, catches, PSIDs, WhatsApp numbers |

---

## 📁 Project Structure

```
EcoFin_Task3/
├── src/
│   ├── routes/
│   │   └── webhook.js          # Meta webhook handler
│   └── services/
│       ├── firebase.js         # Firestore helper functions
│       └── messengerService.js # Messenger & WhatsApp send logic
├── images/                     # App icons and logos
├── auth.js                     # Frontend session check (included on every page)
├── server.js                   # Main Express app
├── dashboard.html              # Home screen
├── login.html                  # Login with Facebook OAuth
├── chat.html                   # Weather, forecast, and catch overview
├── log-catch.html              # Log a new catch
├── history.html                # Catch history
├── profile.html                # User profile + connect messaging accounts
├── style.css                   # Global stylesheet
├── .env                        # Environment variables (not committed)
├── firebaseKey.json.json       # Firebase service account (not committed)
└── package.json
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
PAGE_ACCESS_TOKEN=your_facebook_page_access_token
WHATSAPP_TOKEN=your_whatsapp_cloud_api_token
PHONE_NUMBER_ID=your_whatsapp_phone_number_id
VERIFY_TOKEN=your_custom_webhook_verify_token
APP_ID=your_facebook_app_id
APP_SECRET=your_facebook_app_secret
REDIRECT_URI=https://your-domain.com/auth/messenger/callback
PORT=3000
```

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js v18+
- A [Meta Developer App](https://developers.facebook.com/) with Messenger product enabled
- A Firebase project with Firestore enabled
- [ngrok](https://ngrok.com/) for local webhook testing

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/ecofin-ai.git
   cd ecofin-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Fill in all values in .env
   ```

4. **Add Firebase credentials**
   - Download your service account key from Firebase Console
   - Save it as `firebaseKey.json.json` in the project root

5. **Start ngrok**
   ```bash
   ngrok http 3000
   ```
   - Copy the HTTPS URL and update `REDIRECT_URI` in `.env`
   - Also update the Webhook URL and OAuth Redirect URI in your Meta App settings

6. **Run the server**
   ```bash
   node server.js
   ```

7. **Open in browser**
   ```
   http://localhost:3000/login.html
   ```

---

## 🔗 Meta Integration Notes

> ⚠️ **App Review Required for Public Use**
>
> This app uses Facebook Login and Messenger Platform APIs. In **Development Mode**, only users listed as Developers, Testers, or Admins on the Meta App can log in and receive messages.
>
> To allow any user to connect, the app must go through **Meta App Review**, which requires business verification. This is a platform requirement and not a technical limitation of the app.
>
> All backend logic for Messenger (PSID storage, OAuth, message sending) and WhatsApp (Cloud API, webhook) is fully implemented and tested within Development Mode.

---

## 💬 Catch Notification Format

When a catch is logged, a notification is sent to the user's connected Messenger and/or WhatsApp:

```
New Catch Logged 🎣
Tuna — 25.5 kg (45–60 cm)
📍 North Atlantic
📅 Jan 15, 2024
```

---

## 📊 Firebase Security Rules

Add this to your Firebase Realtime Database rules for better query performance:

```json
{
  "rules": {
    "users": {
      ".indexOn": ["psid", "whatsappNumber"],
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

---

## 👥 Authors

Developed as part of a fisheries management capstone project.

---

## 📄 License

This project is for academic and demonstration purposes.
