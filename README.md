# Evva

**AI-powered personal assistant with real memory and proactive actions. Lives in Telegram.**

🌐 [Leer en Español](README.es.md)

---

## Features

- **Persistent semantic memory** -- remembers everything you tell it
- **Scheduled reminders & proactive messages** -- nudges you at the right time
- **Notes & lists** -- groceries, todos, wishlists, and more
- **Contact management** -- stores and recalls people and relationships
- **Google Calendar integration** -- view and create events
- **Gmail integration** -- read, search, and send emails
- **Personal finance** -- credit cards, income/expenses, savings goals
- **Voice notes** -- Whisper transcription via Groq
- **Photo analysis** -- Claude Vision for image understanding
- **Daily briefing** -- proactive morning summary of your day
- **Web search** -- powered by Brave Search
- **Weather** -- current conditions for any city
- **Configurable LLM model** -- Haiku for development, Sonnet for production
- **Rebrandable** -- change the assistant name via `APP_BRAND_NAME` env var
- **Onboarding flow** -- guided setup for new users
- **Session management** -- automatic conversation grouping with 30-min expiry

---

## Architecture

```
Telegram
   |
   v
+----------------------------------+
|  Gateway (NestJS)                |
|                                  |
|  TelegramModule                  |  <-- receives messages, sends replies
|  ConversationModule              |  <-- orchestrates the agent loop
|  MemoryModule                    |  <-- RAG over user facts
|  PersonaModule                   |  <-- dynamic system prompt
|  ToolsModule                     |  <-- web_search, reminders, etc.
|  SchedulerModule                 |  <-- enqueues jobs via BullMQ
|  UsersModule                     |  <-- user and assistant CRUD
+----------------------------------+
           | BullMQ (Redis)
           v
+----------------------------------+
|  Worker (NestJS)                 |
|                                  |
|  ScheduledJobProcessor           |  <-- executes reminders
|  FactExtractionProcessor         |  <-- extracts facts from conversations
+----------------------------------+
           |
           v
+----------------------------------+
|  PostgreSQL + pgvector           |
|                                  |
|  users                           |
|  assistant_config                |
|  messages                        |
|  memory_facts (pgvector)         |
|  onboarding_state                |
+----------------------------------+
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS + TypeScript |
| Bot | grammY |
| LLM | Claude Sonnet (Vercel AI SDK) |
| Embeddings | Voyage AI (voyage-3-lite, 512 dims) |
| Database | PostgreSQL + pgvector |
| Queue | BullMQ + Redis |
| Transcription | Groq (Whisper) |
| Vision | Claude Vision |
| Search | Brave Search API |
| Monorepo | pnpm workspaces |

---

## Quick Start

For detailed step-by-step instructions, see [`docs/SETUP.md`](docs/SETUP.md).

### Prerequisites

- Node.js >= 22.0.0
- pnpm >= 9.0.0
- PostgreSQL with pgvector extension
- Redis

### Install and run

```bash
git clone https://github.com/anthropic-ai/evva.git
cd evva
pnpm install
cp .env.example .env
# Edit .env with your credentials

pnpm db:migrate

# Terminal 1 -- Gateway (Telegram bot)
pnpm dev:gateway

# Terminal 2 -- Worker (BullMQ processors)
pnpm dev:worker
```

The bot starts in **long polling** mode -- no webhook setup required for local development.

---

## Project Structure

```
evva/
├── apps/
│   ├── gateway/              # Main app -- Telegram bot + API
│   │   └── src/
│   │       ├── telegram/          # Telegram message handler
│   │       ├── conversation/      # Agent loop + onboarding
│   │       ├── memory/            # Fact search and storage
│   │       ├── persona/           # System prompt construction
│   │       ├── tools/             # Tools available to the LLM
│   │       ├── scheduler/         # BullMQ job scheduling
│   │       ├── users/             # User and assistant CRUD
│   │       ├── health/            # Health check endpoints
│   │       └── config/            # Env var validation
│   │
│   └── worker/               # BullMQ worker -- async jobs
│       └── src/
│           ├── processors/        # ScheduledJob + FactExtraction
│           └── handlers/          # TelegramSender
│
├── packages/
│   ├── core/                 # Shared types, constants, and utils
│   ├── database/             # PostgreSQL client (pg) and repositories
│   └── ai/                   # LLM (Claude), embeddings (Voyage), prompts
│
└── docs/                     # Setup guides and documentation
```

---

## How it Works

### Message Flow

1. User sends a message in Telegram.
2. `TelegramService` receives the message.
3. User record is upserted in PostgreSQL.
4. If the user is new, the onboarding flow starts (choose assistant name).
5. If the user is already set up:
   - Semantic search retrieves relevant facts (Voyage + pgvector).
   - A dynamic system prompt is constructed.
   - Recent history is loaded (last 12 messages).
   - Claude is called with all available tools.
   - If the LLM invokes a tool, it is executed and the result is fed back.
   - The final response is sent via Telegram.
   - The message is persisted in PostgreSQL.
   - Fact extraction is enqueued in BullMQ (async).

### Proactive Flow (Reminders)

1. User says "remind me to X on Friday at 8am".
2. Claude calls the `create_reminder` tool.
3. `SchedulerService` creates a BullMQ job with the calculated delay.
4. At the scheduled time, `ScheduledJobProcessor` wakes up.
5. A personalized message is generated with Claude (not plain text).
6. `TelegramSenderService` delivers it to the user.

---

## Available Tools

| Tool | Description | Requires |
|---|---|---|
| `save_fact` | Persist a permanent fact about the user | -- |
| `create_reminder` | Schedule a future reminder | Redis |
| `web_search` | Up-to-date web search | `BRAVE_SEARCH_API_KEY` |
| `get_weather` | Current weather for a city | -- (public API) |
| `manage_notes` | Create, update, and list notes/lists | -- |
| `manage_contacts` | Store and retrieve contacts | -- |
| `google_calendar_list` | List upcoming calendar events | Google OAuth |
| `google_calendar_create` | Create a new calendar event | Google OAuth |
| `gmail_read` | Read recent emails | Google OAuth |
| `gmail_search` | Search emails by query | Google OAuth |
| `gmail_send` | Send an email | Google OAuth |
| `manage_finances` | Track income, expenses, cards, goals | -- |
| `transcribe_voice` | Transcribe voice notes to text | `GROQ_API_KEY` |
| `analyze_photo` | Analyze an image with Claude Vision | -- |
| `daily_briefing` | Generate a morning summary | -- |
| `manage_session` | Reset or inspect conversation session | -- |

---

## Configuration

### Required Environment Variables

| Variable | Where to get it |
|---|---|
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) on Telegram |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `VOYAGE_API_KEY` | [dash.voyageai.com](https://dash.voyageai.com) |
| `DATABASE_URL` | `postgresql://localhost:5432/evva` for local dev |
| `REDIS_URL` | `redis://localhost:6379` for local dev |

### Optional Environment Variables

| Variable | Purpose |
|---|---|
| `BRAVE_SEARCH_API_KEY` | Web search tool ([brave.com/search/api](https://brave.com/search/api/)) |
| `GROQ_API_KEY` | Voice note transcription via Whisper |
| `GOOGLE_CLIENT_ID` | Google Calendar and Gmail integration |
| `GOOGLE_CLIENT_SECRET` | Google Calendar and Gmail integration |
| `APP_BRAND_NAME` | Custom assistant brand name (default: "Evva") |
| `LLM_MODEL` | Override the default Claude model |
| `TELEGRAM_WEBHOOK_URL` | Production only |
| `TELEGRAM_SECRET_TOKEN` | Production only -- generate with `openssl rand -hex 32` |

---

## Development

### Build

```bash
pnpm build            # Build all packages and apps
pnpm build:gateway    # Build gateway only
pnpm build:worker     # Build worker only
```

### Test

```bash
pnpm test             # Run all tests
pnpm test:watch       # Run tests in watch mode
pnpm test:cov         # Run tests with coverage
```

### Lint

```bash
pnpm lint             # Lint all packages
pnpm lint:fix         # Lint and auto-fix
```

### Database

```bash
pnpm db:migrate       # Run pending migrations
pnpm db:migrate:new   # Create a new migration file
pnpm db:seed          # Seed the database (if applicable)
```

---

## Telegram Commands

| Command | Action |
|---|---|
| `/start` | Welcome message and onboarding for new users |
| `/reset` | Start a new conversation session |
| `/memory` | Show a summary of what the assistant remembers |
| `/help` | List available commands |

---

## Contributing

Contributions are welcome. Please follow these guidelines:

1. Fork the repository and create a feature branch.
2. Write tests for any new functionality.
3. Ensure all tests pass (`pnpm test`) and linting is clean (`pnpm lint`).
4. Keep commits focused and write clear commit messages.
5. Open a pull request with a description of what changed and why.

For bugs and feature requests, please open an issue.

---

## License

This project is licensed under the [MIT License](LICENSE).
