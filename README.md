<p align="center">
  <img src="assets/evva-logo.png" alt="Evva" width="200" />
</p>

<h1 align="center">Evva</h1>

<p align="center"><strong>AI-powered personal assistant with real memory and proactive actions. Lives in Telegram and WhatsApp.</strong></p>

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
- **Medication tracking** -- register prescriptions with schedules and reminders
- **Habit tracking** -- daily progress tracking (water, exercise, meditation, etc.)
- **Emergency contacts** -- store and access emergency contacts quickly
- **Document analysis** -- receive and analyze PDFs and files via Claude Vision
- **Location handling** -- receive shared locations and suggest actions
- **Translator** -- inline translation between any languages
- **Exchange rate calculator** -- live currency conversion
- **Smart dictation** -- generate formal or informal messages on demand
- **News summary** -- search and summarize current news
- **Spotify integration** -- now playing, recent tracks, top tracks, search music
- **WhatsApp channel** -- same assistant experience on WhatsApp Business API
- **Birthday tracking** -- proactive birthday reminders from memory
- **Recipe suggestions** -- suggests recipes based on your grocery list
- **Redis cache** -- optimized token usage with cached OAuth providers and context
- **Configurable LLM model** -- Haiku for development, Sonnet for production
- **Rebrandable** -- change the assistant name via `APP_BRAND_NAME` env var
- **Multi-channel** -- Telegram + WhatsApp with identical experience

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
|  DailyBriefingProcessor          |  <-- sends daily morning summaries
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

### Option A -- Docker Compose (recommended)

```bash
git clone https://github.com/lacasoft/evva-ai.git
cd evva-ai
cp .env.example .env
# Edit .env with your credentials (see .env.example for all variables)

docker compose up
```

That's it. PostgreSQL, Redis, migrations, gateway, and worker all start automatically.

### Option B -- Manual setup

```bash
git clone https://github.com/lacasoft/evva-ai.git
cd evva-ai
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
│   ├── ai/                   # LLM (Claude), embeddings (Voyage), prompts
│   └── skills/               # Modular skill plugins (18 skills)
│       └── src/
│           ├── registry.ts        # Central skill registry
│           ├── base-skill.ts      # SkillDefinition interface
│           ├── memory/            # Persistent semantic memory
│           ├── notes/             # Notes and lists
│           ├── contacts/          # Contact management
│           ├── reminders/         # Scheduled reminders
│           ├── finance/           # Personal finance (cards, transactions, savings)
│           ├── health/            # Medication and habit tracking
│           ├── emergency/         # Emergency contacts
│           ├── calendar/          # Google Calendar
│           ├── gmail/             # Gmail (read, search, send)
│           ├── weather/           # Weather lookup
│           ├── search/            # Web search (Brave)
│           ├── news/              # News summary
│           ├── translator/        # Language translation
│           ├── exchange/          # Currency exchange rates
│           ├── dictation/         # Smart message drafting
│           ├── briefing/          # Daily proactive briefing
│           ├── voice/             # Voice note transcription
│           └── vision/            # Photo and document analysis
│
└── docs/                     # Setup guides and documentation
```

## Adding a New Skill

Each skill is a self-contained module. To add a new one:

```typescript
// packages/skills/src/my-skill/index.ts
import { tool } from 'ai';
import { z } from 'zod';
import type { SkillDefinition } from '../base-skill.js';

export const mySkill: SkillDefinition = {
  name: 'my-skill',
  description: 'What this skill does',
  category: 'utility',
  forProfiles: ['young', 'adult', 'senior'],
  requiredEnv: ['MY_API_KEY'],  // optional

  buildTools: (ctx) => ({
    my_tool: tool({
      description: 'Tool description for the LLM',
      parameters: z.object({ input: z.string() }),
      execute: async ({ input }) => {
        return { success: true, result: input };
      },
    }),
  }),

  promptInstructions: [
    '- my_tool: Description of what this tool does',
  ],
};
```

Then register it in `packages/skills/src/index.ts`:
```typescript
export { mySkill } from './my-skill/index.js';
import { mySkill } from './my-skill/index.js';
skillRegistry.register(mySkill);
```

The skill is automatically available to the LLM. No other files need to change.

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
| `create_note` | Create notes or lists | -- |
| `get_notes` | View active notes and lists | -- |
| `update_note` | Modify, check items, archive or delete notes | -- |
| `save_contact` | Store a contact (name, phone, email, relationship) | -- |
| `search_contacts` | Search contacts by name or relationship | -- |
| `add_credit_card` | Register a credit card with cut-off and payment dates | -- |
| `get_credit_cards` | View registered cards with balances | -- |
| `record_transaction` | Log income or expense | -- |
| `get_finance_summary` | Monthly financial summary by category | -- |
| `get_recent_transactions` | View recent transactions | -- |
| `create_savings_goal` | Create a savings goal with target amount | -- |
| `get_savings_goals` | View savings progress | -- |
| `connect_google` | Generate Google OAuth link (Calendar + Gmail) | Google OAuth |
| `list_calendar_events` | List upcoming calendar events | Google OAuth |
| `create_calendar_event` | Create a new calendar event | Google OAuth |
| `list_emails` | List recent emails | Google OAuth |
| `read_email` | Read full email content | Google OAuth |
| `send_email` | Send an email from user's Gmail | Google OAuth |
| `add_medication` | Register a medication with schedule | -- |
| `get_medications` | View active medications | -- |
| `create_habit` | Create a habit to track daily | -- |
| `log_habit` | Log progress on a habit | -- |
| `get_habit_progress` | View today's habit completion | -- |
| `add_emergency_contact` | Register an emergency contact | -- |
| `get_emergency_contacts` | View emergency contacts | -- |
| `configure_daily_briefing` | Enable/disable daily morning summary | -- |
| `translate` | Translate text between languages | -- |
| `calculate_exchange_rate` | Live currency conversion | -- |
| `draft_message` | Generate formal/informal messages | -- |
| `summarize_news` | Search and summarize current news | `BRAVE_SEARCH_API_KEY` |
| `web_search` | Up-to-date web search | `BRAVE_SEARCH_API_KEY` |
| `get_weather` | Current weather for a city | -- |

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
