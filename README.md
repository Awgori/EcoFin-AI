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
| Open-Meteo API | Free weather and forecast data (no key needed) |
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
├── auth.js                     # Frontend session check
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

## 🚀 Full Setup Guide

Follow these steps **in order**. This guide assumes you are starting from scratch.

---

### ✅ Prerequisites

Make sure you have these installed before starting:

- [Node.js v18+](https://nodejs.org/) — download and install the LTS version
- [ngrok](https://ngrok.com/download) — create a free account and download
- A [Facebook account](https://facebook.com) — needed for Meta Developer access
- A [Google account](https://google.com) — needed for Firebase

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/your-username/ecofin-ai.git
cd ecofin-ai
npm install
```

---

### Step 2 — Set Up Firebase

Firebase is used as the database to store users, catches, and messaging IDs.

#### 2A — Create a Firebase Project
1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**
3. Enter a project name (e.g. `ecofin-ai`) and click **Continue**
4. Disable Google Analytics (not needed) and click **Create project**

#### 2B — Enable Firestore
1. In the left sidebar, click **Build** → **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (you can tighten rules later)
4. Select a region closest to you (e.g. `asia-southeast1` for Philippines) and click **Enable**

#### 2C — Create the Database Collections
Firestore is schema-less but EcoFin expects two collections. Create them manually:

**`users` collection**
1. Click **Start collection** → name it `users`
2. Add a test document with these fields:

| Field | Type | Example Value |
|---|---|---|
| `name` | string | Test User |
| `facebookId` | string | 123456789 |
| `psid` | string | _(leave blank for now)_ |
| `whatsappNumber` | string | _(leave blank for now)_ |
| `createdAt` | timestamp | _(auto)_ |

**`catches` collection**
1. Click **Start collection** → name it `catches`
2. Add a test document with these fields:

| Field | Type | Example Value |
|---|---|---|
| `userId` | string | 123456789 |
| `species` | string | Tuna |
| `weight` | number | 25.5 |
| `size` | string | 45-60 |
| `source` | string | Ocean |
| `location` | string | Manila Bay |
| `lat` | number | 14.5995 |
| `lng` | number | 120.9842 |
| `timestamp` | timestamp | _(auto)_ |

#### 2D — Get the Service Account Key
This allows the backend to talk to Firebase with admin privileges.

1. In Firebase Console, click the ⚙️ gear icon → **Project settings**
2. Go to the **Service accounts** tab
3. Click **Generate new private key** → **Generate key**
4. A JSON file will download — rename it to `firebaseKey.json.json`
5. Move it into the **root of your project folder**

> ⚠️ Never share or commit this file. It gives full access to your database.

#### 2E — Get your Firebase Web Config
This is used by the frontend HTML files to connect directly to Firestore.

1. In Firebase Console → **Project settings** → **General** tab
2. Scroll down to **Your apps** → click the `</>` Web icon to register a web app
3. Give it a name (e.g. `ecofin-web`) and click **Register app**
4. Copy the `firebaseConfig` object shown — it looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "ecofin-ai.firebaseapp.com",
  projectId: "ecofin-ai",
  storageBucket: "ecofin-ai.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

5. Find where `firebaseConfig` is defined in your HTML files (`dashboard.html`, `chat.html`, `log-catch.html`, `history.html`) and replace the existing config with yours.

#### 2F — Add Firestore Index (Performance)
1. In Firebase Console → **Firestore Database** → **Indexes** tab
2. Click **Add index**
3. Collection: `users`, Field: `psid`, Order: Ascending
4. Click **Create**

---

### Step 3 — Set Up the Meta Developer App

This is needed for Facebook Login, Messenger, and WhatsApp.

#### 3A — Create a Meta Developer Account
1. Go to [https://developers.facebook.com](https://developers.facebook.com)
2. Log in with your Facebook account
3. Click **Get Started** and complete the developer registration

#### 3B — Create a New App
1. Go to [https://developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Click **Create App**
3. Select **Other** → **Next**
4. Select **Business** as the app type → **Next**
5. Enter an app name (e.g. `EcoFin AI`) and your email
6. Click **Create app**

#### 3C — Add the Messenger Product
1. On your app dashboard, find **Messenger** in the product list and click **Set up**
2. Under **Access Tokens**, click **Add or remove Pages** and connect your Facebook Page

> ℹ️ If you don't have a Facebook Page: go to [facebook.com/pages/create](https://facebook.com/pages/create), create a simple page (e.g. "EcoFin App"), then come back and connect it.

3. After connecting, click **Generate token** next to your page
4. Copy this token — this is your `PAGE_ACCESS_TOKEN`

#### 3D — Get Your App Credentials
1. In your Meta App dashboard, go to **Settings** → **Basic**
2. Copy the **App ID** — this is your `APP_ID`
3. Click **Show** next to App Secret and copy it — this is your `APP_SECRET`

#### 3E — Add WhatsApp Product
1. On your app dashboard, find **WhatsApp** in the product list and click **Set up**
2. Under **API Setup**, you will see a **Phone number ID** and a **Temporary access token**
3. Copy the **Phone number ID** — this is your `PHONE_NUMBER_ID`
4. Copy the **Temporary access token** — this is your `WHATSAPP_TOKEN`

> ⚠️ The temporary WhatsApp token expires every 24 hours during development. Generate a permanent System User token for longer sessions.

#### 3F — Add Test Users
Since your app is in Development Mode, only approved testers can use Facebook Login.

1. In your Meta App dashboard, go to **App Roles** → **Roles**
2. Click **Add Testers**
3. Enter the Facebook username or email of each person who needs to test the app
4. They will receive a notification to accept the tester role

---

### Step 4 — Set Up ngrok

ngrok creates a public HTTPS URL that points to your local server. Meta requires HTTPS for webhooks and OAuth callbacks.

#### 4A — Start ngrok
```bash
ngrok http 3000
```

You will see output like:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

Copy the `https://` URL — you will use it in the next steps.

> ⚠️ This URL changes every time you restart ngrok on the free plan. When it changes, repeat steps 4B and 4C.

#### 4B — Set the Webhook in Meta App
1. In your Meta App dashboard, go to **Messenger** → **Settings**
2. Under **Webhooks**, click **Add Callback URL**
3. Enter:
   - **Callback URL:** `https://your-ngrok-url.ngrok-free.app/webhook`
   - **Verify Token:** `EcoFinVerify123`
4. Click **Verify and Save**
5. Under **Webhook fields**, subscribe to `messages` and `messaging_postbacks`

#### 4C — Set the OAuth Redirect URI
1. In your Meta App dashboard, go to **Facebook Login** → **Settings**

> ℹ️ If Facebook Login is not added yet: on the app dashboard find **Facebook Login** and click **Set up** → **Web**

2. Under **Valid OAuth Redirect URIs**, add:
   ```
   https://your-ngrok-url.ngrok-free.app/auth/messenger/callback
   ```
3. Click **Save changes**

---

### Step 5 — Configure Environment Variables

Create a file called `.env` in the root of your project:

```env
# Facebook / Messenger
PAGE_ACCESS_TOKEN=paste_your_page_access_token_here
APP_ID=paste_your_app_id_here
APP_SECRET=paste_your_app_secret_here
REDIRECT_URI=https://your-ngrok-url.ngrok-free.app/auth/messenger/callback

# WhatsApp
WHATSAPP_TOKEN=paste_your_whatsapp_token_here
PHONE_NUMBER_ID=paste_your_phone_number_id_here

# Webhook
VERIFY_TOKEN=EcoFinVerify123

# Server
PORT=3000
```

Replace every `paste_your_..._here` with the actual values from the steps above.

---

### Step 6 — Run the App

```bash
node server.js
```

You should see:
```
Server running on port 3000
```

Open your browser and go to:
```
http://localhost:3000/login.html
```

---

### Step 7 — Test the App

1. Click the **Facebook icon** on the login page
2. Log in with a Facebook account that is listed as a Tester on your Meta App
3. Authorize the app when prompted
4. You should be redirected to the dashboard
5. Try logging a catch — a Messenger notification should be sent to your Facebook account

---

## ⚠️ Important Notes

### App Review Requirement
This app is in **Development Mode** on Meta. Only users added as Testers, Developers, or Admins in the Meta App dashboard can log in and receive messages. To allow any public user to connect, the app must go through **Meta App Review**, which requires business verification. All backend logic is fully implemented and tested within Development Mode.

### ngrok URL Changes
Every time you restart ngrok (free plan), you get a new URL. When this happens you must:
1. Update `REDIRECT_URI` in your `.env` file
2. Update the Callback URL in Meta App → Messenger → Webhooks
3. Update the OAuth Redirect URI in Meta App → Facebook Login → Settings
4. Restart your server with `node server.js`

### WhatsApp Token Expiry
The WhatsApp temporary access token expires every 24 hours. For longer testing sessions, generate a System User token from your Meta Business Manager.

### Firebase Security Rules
Once you are done testing, update your Firestore rules from test mode to production mode:
1. Go to Firebase Console → Firestore → **Rules** tab
2. Replace the rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }
    match /catches/{catchId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 💬 Catch Notification Format

When a catch is logged, a notification is sent to the user's connected Messenger and/or WhatsApp:

```
New Catch Logged 🎣
Tuna — 25.5 kg (45–60 cm)
📍 Manila Bay
📅 Feb 20, 2026
```

---


