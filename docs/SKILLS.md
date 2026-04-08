# Evva — Complete Skill Registry

> Source of truth for all 28 skills and 60 tools.
> Last updated: 2026-04-08

## Summary

| Metric | Value |
|---|---|
| Total skills | 28 |
| Total tools | 60 |
| Categories | 6 (productivity, finance, health, communication, utility, search) |
| OAuth integrations | 3 (Google, Spotify, + runtime) |
| Channels | 2 (Telegram, WhatsApp) |

---

## Skills by Category

### Productivity (7 skills, 12 tools)

| # | Skill | Tools | Profiles |
|---|---|---|---|
| 1 | **memory** | `save_fact` | all |
| 2 | **notes** | `create_note`, `get_notes`, `update_note` | all |
| 3 | **contacts** | `save_contact`, `search_contacts` | all |
| 4 | **data-management** | `update_user_data`, `delete_user_data` | all |
| 5 | **reminders** | `create_reminder` | all |
| 6 | **briefing** | `configure_daily_briefing` | all |
| 7 | **birthdays** | `save_birthday`, `check_upcoming_birthdays` | all |

### Finance (2 skills, 11 tools)

| # | Skill | Tools | Profiles |
|---|---|---|---|
| 8 | **finance** | `add_credit_card`, `get_credit_cards`, `record_transaction`, `get_finance_summary`, `get_recent_transactions`, `create_savings_goal`, `get_savings_goals` | young, adult |
| 9 | **finance-security** | `set_finance_secret`, `verify_finance_secret`, `check_finance_protection`, `disable_finance_secret` | all |

### Health (2 skills, 7 tools)

| # | Skill | Tools | Profiles |
|---|---|---|---|
| 10 | **health** | `add_medication`, `get_medications`, `create_habit`, `log_habit`, `get_habit_progress` | adult, senior |
| 11 | **emergency** | `add_emergency_contact`, `get_emergency_contacts` | senior, adult |

### Communication (3 skills, 9 tools)

| # | Skill | Tools | OAuth | Profiles |
|---|---|---|---|---|
| 12 | **calendar** | `connect_google`, `list_calendar_events`, `create_calendar_event` | google | all |
| 13 | **gmail** | `list_emails`, `read_email`, `send_email` | google | all |
| 14 | **email-cleaner** | `scan_promotional_emails`, `unsubscribe_from_sender`, `bulk_unsubscribe` | google | young, adult |

### Utility (11 skills, 19 tools)

| # | Skill | Tools | Requires | Profiles |
|---|---|---|---|---|
| 15 | **weather** | `get_weather` | — | all |
| 16 | **translator** | `translate` | — | all |
| 17 | **exchange** | `calculate_exchange_rate` | — | young, adult |
| 18 | **dictation** | `draft_message` | — | all |
| 19 | **voice** | *(Telegram handler)* | GROQ_API_KEY | all |
| 20 | **vision** | *(Telegram handler)* | — | all |
| 21 | **skill-creator** | `create_runtime_skill`, `list_runtime_skills`, `disable_runtime_skill` | — | young, adult |
| 22 | **recipes** | `suggest_recipes` | — | all |
| 23 | **tts** | `respond_with_voice` | OPENAI_API_KEY | all |
| 24 | **spotify** | `connect_spotify`, `now_playing`, `recent_tracks`, `top_tracks`, `search_music` | SPOTIFY_CLIENT_ID | young, adult |
| 25 | **travel** | `search_flights`, `search_airport`, `get_booking_link`, `search_buses`, `get_travel_page_info` | SERPAPI_API_KEY | young, adult |

### Search (2 skills, 2 tools)

| # | Skill | Tools | Requires | Profiles |
|---|---|---|---|---|
| 26 | **search** | `web_search` | BRAVE_SEARCH_API_KEY | all |
| 27 | **news** | `summarize_news` | BRAVE_SEARCH_API_KEY | all |

---

## Environment Variables Required by Skills

| Variable | Skills that use it | Free tier |
|---|---|---|
| `ANTHROPIC_API_KEY` | Core LLM (all skills) | $5 credit |
| `VOYAGE_API_KEY` | Memory embeddings | 50M tokens/month |
| `GROQ_API_KEY` | voice (Whisper transcription) | 14,400 req/day |
| `OPENAI_API_KEY` | tts (voice responses) | Pay per use |
| `BRAVE_SEARCH_API_KEY` | search, news | 2,000/month |
| `SERPAPI_API_KEY` | travel (flights) | 250/month |
| `FIRECRAWL_API_KEY` | travel (buses, scraping) | 500 credits |
| `GOOGLE_CLIENT_ID` + `SECRET` | calendar, gmail, email-cleaner | Free |
| `SPOTIFY_CLIENT_ID` + `SECRET` | spotify | Free |

---

## OAuth Integrations

| Provider | Skills | Scopes |
|---|---|---|
| Google | calendar, gmail, email-cleaner | calendar, calendar.events, gmail.readonly, gmail.send |
| Spotify | spotify | user-read-currently-playing, user-read-recently-played, user-top-read, playlist-read-private |

---

## Adding a New Skill

See [README.md — Adding a New Skill](../README.md#adding-a-new-skill) for the complete guide.

```
packages/skills/src/my-skill/index.ts  ← create skill
packages/skills/src/index.ts           ← register it
```
