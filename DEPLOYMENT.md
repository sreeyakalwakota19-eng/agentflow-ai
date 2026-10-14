# Agentflow AI — Production Deployment Guide

This guide provides step-by-step instructions to deploy Agentflow AI into a production environment using **Vercel** (Next.js frontend) and **Render** (Node.js/Express + Socket.IO backend) backed by **MongoDB Atlas** and **Redis**.

---

## 1. Target Production Architecture

```
                               ┌────────────────────────────────┐
                               │       GitHub Repository        │
                               └──────┬──────────────────┬──────┘
                                      │                  │
                         push to main │                  │ push to main
                                      ▼                  ▼
┌──────────────────────────────────────┐        ┌──────────────────────────────────────┐
│        Vercel (Next.js App)          │        │      Render (Web Service)            │
│  Directory: /client                  │        │  Directory: /server                  │
│  Domain: https://agentflow.vercel.app│◄──────►│  Domain: https://api-agentflow.render│
└──────────────────────────────────────┘  CORS  └──────┬──────────────────────┬────────┘
                                           &           │                      │
                                        Sockets        ▼                      ▼
                                                ┌───────────────┐      ┌───────────────┐
                                                │ MongoDB Atlas │      │ Redis/BullMQ  │
                                                │ (Cluster Tier)│      │ (Queue Cache) │
                                                └───────────────┘      └───────────────┘
```

---

## 2. Vercel Deployment (Frontend)

### Step 1: Import Project in Vercel
1. Log in to your [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** $\to$ **Project** and select your `agentflow-ai` GitHub repository.
3. Configure the project settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `client` *(Click "Edit" and select the `client` folder)*
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### Step 2: Configure Environment Variables in Vercel
Add the following variables under **Project Settings** $\to$ **Environment Variables**:

| Variable Name | Description | Example Value |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Render backend API endpoint | `https://your-backend.onrender.com/api` |
| `NEXT_PUBLIC_SOCKET_URL` | Render backend Socket.IO origin | `https://your-backend.onrender.com` |

---

## 3. Render Deployment (Backend & Workers)

### Step 1: Create a Web Service on Render
1. Log in to your [Render Dashboard](https://render.com).
2. Click **New +** $\to$ **Web Service**.
3. Connect your `agentflow-ai` GitHub repository.
4. Fill in the service configuration:
   - **Name**: `agentflow-backend`
   - **Region**: Select closest to your MongoDB/Redis instances (e.g., `Oregon (US West)` or `Frankfurt (EU)`)
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start` *(runs `node src/server.js`)*
   - **Plan**: `Starter` (or higher — WebSockets & background workers require persistent instances)

### Step 2: Configure Health Check Path
Under **Advanced**:
- **Health Check Path**: `/api/health`

### Step 3: Configure Environment Variables in Render
Add the following variables under **Environment Variables**:

| Variable Name | Required | Description | Example / Recommended Format |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | Node environment | `production` |
| `PORT` | Auto | Assigned by Render automatically | *(Render manages this)* |
| `CLIENT_URL` | Yes | Production frontend URL (for CORS & redirects) | `https://your-app.vercel.app` |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string | `mongodb+srv://<user>:<pass>@cluster0.mongodb.net/agentflow?retryWrites=true&w=majority` |
| `REDIS_URL` | Optional | Redis connection string (Render Redis / Upstash) | `rediss://default:<pass>@<host>:6379` |
| `JWT_SECRET` | Yes | Strong 64+ char random secret key | *(Use `openssl rand -hex 32`)* |
| `JWT_EXPIRES_IN` | Yes | Session validity duration | `7d` |
| `CREDENTIALS_ENCRYPTION_KEY` | Yes | 32-byte (64 hex characters) key for AES-256-GCM | *(Use `openssl rand -hex 32`)* |
| `OPENROUTER_API_KEY` | Optional | Primary AI Model provider key | `sk-or-v1-...` |
| `GEMINI_API_KEY` | Optional | Fallback AI Model provider key | `AIzaSy...` |
| `GOOGLE_CLIENT_ID` | Optional | OAuth Client ID for Gmail & Sheets | `123456789.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Optional | OAuth Client Secret for Google | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | Optional | Callback URL for Google OAuth | `https://your-backend.onrender.com/api/integrations/oauth/gmail/callback` |
| `GOOGLE_SHEETS_REDIRECT_URI`| Optional | Callback URL for Google Sheets OAuth | `https://your-backend.onrender.com/api/integrations/oauth/google_sheets/callback` |
| `SLACK_CLIENT_ID` | Optional | Slack App Client ID | `12345.67890` |
| `SLACK_CLIENT_SECRET` | Optional | Slack App Client Secret | `a1b2c3d4...` |
| `SLACK_REDIRECT_URI` | Optional | Callback URL for Slack OAuth | `https://your-backend.onrender.com/api/integrations/oauth/slack/callback` |
| `DISCORD_CLIENT_ID` | Optional | Discord App Client ID | `123456789012345678` |
| `DISCORD_CLIENT_SECRET` | Optional | Discord App Client Secret | `abcdEFGH...` |
| `DISCORD_REDIRECT_URI` | Optional | Callback URL for Discord OAuth | `https://your-backend.onrender.com/api/integrations/oauth/discord/callback` |

---

## 4. Database Setup (MongoDB Atlas)

1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Under **Database Access**, create a user with `Read and write to any database` permissions.
3. Under **Network Access**, add `0.0.0.0/0` (allow access from anywhere, secured by authentication credentials) or add Render's outbound IP addresses.
4. Click **Connect** $\to$ **Connect your application** $\to$ copy the URI connection string.
5. Paste it into Render's `MONGODB_URI` environment variable.

---

## 5. Background Queue Setup (Redis)

Agentflow AI features an automated dual-mode execution engine:
1. **Production Redis**: Provide a `REDIS_URL` (such as Render Redis or Upstash Redis with TLS `rediss://...`) to enable distributed BullMQ worker processing with automatic exponential backoff retries.
2. **Built-in Async Fallback**: If `REDIS_URL` is omitted, the engine automatically operates in asynchronous in-memory mode without crashing.

---

## 6. OAuth Provider Redirect URLs Checklist

Register the following redirect URLs in your respective developer consoles:

| Integration Provider | Developer Console | Authorized Redirect URI |
| :--- | :--- | :--- |
| **Gmail** | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) | `https://your-backend.onrender.com/api/integrations/oauth/gmail/callback` |
| **Google Sheets** | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) | `https://your-backend.onrender.com/api/integrations/oauth/google_sheets/callback` |
| **Slack** | [Slack API Apps](https://api.slack.com/apps) | `https://your-backend.onrender.com/api/integrations/oauth/slack/callback` |
| **Discord** | [Discord Developer Portal](https://discord.com/developers/applications) | `https://your-backend.onrender.com/api/integrations/oauth/discord/callback` |

---

## 7. Pre-Flight Verification & Health Check

After deployment, verify the following endpoints:

1. **Backend Health Check**:
   ```bash
   curl -i https://your-backend.onrender.com/api/health
   ```
   **Expected Response:**
   ```json
   {
     "success": true,
     "message": "Agentflow API is running",
     "database": {
       "status": "connected",
       "connected": true
     },
     "realtime": {
       "socketIo": true
     }
   }
   ```

2. **Frontend UI**:
   - Open `https://your-app.vercel.app/login`
   - Register a new operator account
   - Build or AI-generate a workflow
   - Trigger execution and observe real-time Socket.IO streaming on `/executions/[id]`
   - Verify notifications drawer updates in the top navigation bar.
