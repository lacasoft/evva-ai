# Evva -- Setup from Scratch

[Leer en Español](SETUP.es.md)

Complete guide to get the bot running on your local machine.

---

## What You Will Need

- A computer running macOS, Linux, or Windows (with WSL2)
- Internet connection
- A Telegram account on your phone

---

## Step 1 -- Install Base Tools

### Node.js 22

```bash
node --version
# Should show v22.x.x or higher
```

If you don't have it, install with nvm:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# Restart your terminal, then:
nvm install 22
nvm use 22
nvm alias default 22
```

### pnpm

```bash
npm install -g pnpm
pnpm --version   # 9.x.x or higher
```

### PostgreSQL + pgvector

**With Docker (recommended):**
```bash
docker run -d --name evva-db \
  -p 5432:5432 \
  -e POSTGRES_USER=evva \
  -e POSTGRES_PASSWORD=evva \
  -e POSTGRES_DB=evva \
  pgvector/pgvector:pg16
```

**Native macOS:**
```bash
brew install postgresql@16 pgvector
brew services start postgresql@16
createdb evva
psql evva -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Native Ubuntu/Debian:**
```bash
sudo apt install postgresql postgresql-contrib postgresql-16-pgvector
sudo systemctl start postgresql
createdb evva
psql evva -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Redis

**With Docker (recommended):**
```bash
docker run -d --name evva-redis -p 6379:6379 redis:alpine
```

**With password:**
```bash
docker run -d --name evva-redis -p 6379:6379 redis:alpine redis-server --requirepass yourpassword
```

**Native macOS:**
```bash
brew install redis && brew services start redis
```

**Native Ubuntu:**
```bash
sudo apt install redis-server
sudo systemctl start redis
```

### ngrok (for testing OAuth from your phone)

Required so that Google OAuth can redirect to the callback from your phone.

1. Create a free account at [dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)
2. Copy your authtoken from [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Install and configure:
```bash
# Ubuntu/Debian
sudo snap install ngrok

# macOS
brew install ngrok

# Configure authtoken
ngrok config add-authtoken YOUR_AUTHTOKEN
```

---

## Step 2 -- Create the Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send it: `/newbot`
3. Bot name: `Evva`
4. Bot username (unique, must end in `bot`): `evva_dev_bot`
5. BotFather will reply with a token:
   ```
   7234567890:AAHdqTcvCH1vGWJxfSeofSDs0eJoksvvSDA
   ```
6. Save that token -- it goes in the `.env` file

---

## Step 3 -- Obtain API Keys

### Anthropic -- Claude (required)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account -> **API Keys** -> **Create Key**
3. Copy the key: `sk-ant-...`
4. Add credits ($5 minimum) under Plans & Billing

The default model is **Haiku** (~$0.25/million tokens). To switch to Sonnet, set `LLM_MODEL=claude-sonnet-4-5` in the `.env` file.

### Voyage AI -- Embeddings (required)

1. Go to [dash.voyageai.com](https://dash.voyageai.com)
2. Create an account -> **API Keys** -> **Create new key**
3. Copy the key: `pa-...`

Free tier: 50M tokens/month.

### Groq -- Voice Transcription (optional, free)

If you want the bot to process voice notes:

1. Go to [console.groq.com](https://console.groq.com)
2. Create an account (free, no credit card required)
3. **API Keys** -> **Create**
4. Copy the key: `gsk_...`

### Brave Search (optional, free)

For web search:

1. Go to [brave.com/search/api](https://brave.com/search/api/)
2. Free plan: 2,000 searches/month
3. Copy your API key

### Google -- Calendar and Gmail (optional)

For Google Calendar and Gmail integration:

#### 3.1 Create a Project in Google Cloud

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g., "Evva")
3. Go to **APIs & Services** -> **Library**
4. Search for and enable these APIs:
   - **Google Calendar API**
   - **Gmail API**

#### 3.2 Create OAuth Credentials

1. Go to **APIs & Services** -> **Credentials**
2. Click **Create Credentials** -> **OAuth client ID**
3. If prompted, configure the **OAuth consent screen** first:
   - User Type: **External**
   - App name: "Evva" (or whatever you prefer)
   - User support email: your email
   - Scopes: do not add any scopes here
   - Test users: **add your email** (important for testing mode)
4. Go back to Credentials -> **Create Credentials** -> **OAuth client ID**
5. Application type: **Web application**
6. Name: "Evva Dev"
7. **Authorized redirect URIs**: add your callback URI:
   - For local development: `http://localhost:3000/api/oauth/google/callback`
   - For testing from your phone with ngrok: `https://YOUR-URL.ngrok-free.app/api/oauth/google/callback`
8. Click **Create**
9. Copy the **Client ID** and **Client Secret**

**IMPORTANT:** Under **OAuth consent screen** -> **Test users**, add the email of every person who will be testing. Without this, Google will block access with a 403 error.

---

## Step 4 -- Configure the Project

### 4.1 Clone and Install

```bash
git clone https://github.com/your-username/evva.git
cd evva
pnpm install
```

### 4.2 Create the Environment Variables File

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
NODE_ENV=development
PORT=3000

# Telegram (Step 2)
TELEGRAM_BOT_TOKEN=7234567890:AAHdqTcvCH1vGWJxfSeofSDs0eJoksvvSDA
TELEGRAM_WEBHOOK_URL=
TELEGRAM_SECRET_TOKEN=

# Claude (Step 3)
ANTHROPIC_API_KEY=sk-ant-api03-...

# LLM Model (haiku = cheap, sonnet = better quality)
LLM_MODEL=claude-haiku-4-5-20251001

# Voyage AI (Step 3)
VOYAGE_API_KEY=pa-...

# PostgreSQL
# Docker: postgresql://evva:evva@localhost:5432/evva
# Native: postgresql://localhost:5432/evva
# With password: postgresql://user:password@localhost:5432/evva
DATABASE_URL=postgresql://evva:evva@localhost:5432/evva

# Redis
# Without password: redis://localhost:6379/0
# With password: redis://:yourpassword@localhost:6379/0
REDIS_URL=redis://localhost:6379/0

# Groq -- voice notes (optional)
GROQ_API_KEY=gsk_...

# Brave Search (optional)
BRAVE_SEARCH_API_KEY=

# Google OAuth -- Calendar + Gmail (optional)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/google/callback
```

### 4.3 Run Migrations

```bash
pnpm db:migrate
```

You should see:
```
  -> Applying 001_initial_schema.sql...
  OK 001_initial_schema.sql applied
  -> Applying 002_notes_contacts.sql...
  OK 002_notes_contacts.sql applied
  -> Applying 003_daily_briefing.sql...
  OK 003_daily_briefing.sql applied
  -> Applying 004_oauth_tokens.sql...
  OK 004_oauth_tokens.sql applied
  -> Applying 005_finances.sql...
  OK 005_finances.sql applied

Migrations completed.
```

---

## Step 5 -- Run the Project

You need **two terminals**:

### Terminal 1 -- Gateway (Telegram bot)

```bash
pnpm build && cd apps/gateway && node dist/main.js
```

You should see:
```
[SchedulerService] Connecting to Redis: redis://:***@localhost:6379/0
[SchedulerService] Scheduler connected to Redis
[TelegramService] Initializing Telegram bot...
[TelegramService] Bot started with long polling
[Bootstrap] Evva Gateway running on port 3000
```

### Terminal 2 -- Worker (async jobs)

```bash
cd apps/worker && node dist/main.js
```

You should see:
```
[ScheduledJobProcessor] ScheduledJobProcessor started
[FactExtractionProcessor] FactExtractionProcessor started
[DailyBriefingProcessor] DailyBriefingProcessor started
[WorkerBootstrap] Evva Worker started -- processing queues
```

### Terminal 3 -- ngrok (only if testing OAuth from your phone)

```bash
ngrok http 3000
```

Copy the URL it gives you (e.g., `https://abc123.ngrok-free.app`) and update:
1. `.env`: `GOOGLE_REDIRECT_URI=https://abc123.ngrok-free.app/api/oauth/google/callback`
2. Google Cloud Console -> Credentials -> OAuth Client -> add the same URI
3. Restart the gateway

---

## Step 6 -- Test the Bot

1. Open Telegram -> search for your bot -> type `/start`
2. Choose a name for your assistant (e.g., "Luna")
3. Try these features:

**Conversation:**
```
Hi, what can you do?
```

**Memory:**
```
My wife's name is Laura and her birthday is March 15th
```

**Reminders:**
```
Remind me in 2 minutes that I need to call Laura
```

**Notes and lists:**
```
Make a grocery list: milk, eggs, bread, tortillas
```

**Contacts:**
```
Save my dentist's contact: Dr. Lopez, 5512345678
```

**Finances:**
```
Add my BBVA Gold card, ending in 4523, statement closes on the 15th, due on the 5th
I spent $850 at the grocery store with my BBVA
How much have I spent this month?
```

**Voice notes:**
Send an audio message and the bot will transcribe and process it.

**Photos:**
Send a photo of a receipt, menu, or document.

**Google Calendar + Gmail** (if you configured Google):
```
Connect my Google
What do I have on my calendar this week?
What unread emails do I have?
Send an email to example@gmail.com saying I'll be late
```

---

## Common Issues

### "Credit balance is too low"
Top up credits at [console.anthropic.com](https://console.anthropic.com) -> Plans & Billing. Or switch to Haiku: `LLM_MODEL=claude-haiku-4-5-20251001`

### "TELEGRAM_BOT_TOKEN not configured"
Verify that the token is complete in `.env`, with no spaces.

### "Missing DATABASE_URL"
Verify `DATABASE_URL` in `.env`. If using Docker: `postgresql://evva:evva@localhost:5432/evva`

### "relation 'users' does not exist"
Run the migrations: `pnpm db:migrate`

### "could not create extension vector"
If using Docker with `pgvector/pgvector:pg16`, it is already included. If native: `sudo apt install postgresql-16-pgvector`

### "Redis connection error"
Verify that Redis is running: `docker exec -it evva-redis redis-cli ping` (should respond PONG).

### "redirect_uri_mismatch" on Google OAuth
The URI must be EXACTLY the same in 3 places:
1. `.env` -> `GOOGLE_REDIRECT_URI`
2. Google Cloud Console -> Credentials -> OAuth Client -> Authorized redirect URIs
3. The actual gateway port (check logs)

If testing from your phone, use ngrok and update the URI with the ngrok URL.

### "Gmail API has not been used in project"
Enable the Gmail API in Google Cloud Console -> APIs & Services -> Library -> search "Gmail API" -> Enable.

### "Access blocked: has not completed verification"
In Google Cloud Console -> OAuth consent screen -> Test users, add the user's email.

### Bot does not respond on Telegram
1. Verify that the gateway is running without errors
2. Verify the token in `.env`
3. If you killed the previous process, another process may still be polling. Restart.

---

## Useful Commands

```bash
pnpm build              # Build everything
pnpm test               # Run tests (120 tests)
pnpm dev:gateway         # Gateway in watch mode
pnpm dev:worker          # Worker in watch mode
pnpm db:migrate          # Run pending migrations
pnpm typecheck           # Type-check without building
```

---

## Development Cost Structure

| Service | Free Tier | Dev Cost |
|---|---|---|
| PostgreSQL (local) | -- | $0 |
| Redis (local) | -- | $0 |
| Voyage AI | 50M tokens/month | $0 |
| Groq (Whisper) | 14,400 req/day | $0 |
| Brave Search | 2,000 searches/month | $0 |
| ngrok | 1 free tunnel | $0 |
| Claude Haiku | -- | ~$0.001/conversation |
| Claude Sonnet | -- | ~$0.01/conversation |
| Google APIs | Generous quota | $0 |

**Total for development: ~$5 USD** (initial Anthropic credits).
