# Evva — Setup desde cero

> [Read in English](SETUP.md)

Guia completa para tener el bot corriendo en tu maquina local.

---

## Lo que vas a necesitar

- Una computadora con macOS, Linux, o Windows (con WSL2)
- Conexion a internet
- Cuenta de Telegram en tu celular

---

## Paso 1 — Instalar herramientas base

### Node.js 22

```bash
node --version
# Debe mostrar v22.x.x o mayor
```

Si no lo tienes, instala con nvm:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# Reiniciar terminal, luego:
nvm install 22
nvm use 22
nvm alias default 22
```

### pnpm

```bash
npm install -g pnpm
pnpm --version   # 9.x.x o mayor
```

### PostgreSQL + pgvector

**Con Docker (recomendado):**
```bash
docker run -d --name evva-db \
  -p 5432:5432 \
  -e POSTGRES_USER=evva \
  -e POSTGRES_PASSWORD=evva \
  -e POSTGRES_DB=evva \
  pgvector/pgvector:pg16
```

**Nativo macOS:**
```bash
brew install postgresql@16 pgvector
brew services start postgresql@16
createdb evva
psql evva -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Nativo Ubuntu/Debian:**
```bash
sudo apt install postgresql postgresql-contrib postgresql-16-pgvector
sudo systemctl start postgresql
createdb evva
psql evva -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Redis

**Con Docker (recomendado):**
```bash
docker run -d --name evva-redis -p 6379:6379 redis:alpine
```

**Con password:**
```bash
docker run -d --name evva-redis -p 6379:6379 redis:alpine redis-server --requirepass tupassword
```

**Nativo macOS:**
```bash
brew install redis && brew services start redis
```

**Nativo Ubuntu:**
```bash
sudo apt install redis-server
sudo systemctl start redis
```

### ngrok (para pruebas con OAuth desde celular)

Se necesita para que Google OAuth pueda redirigir al callback desde tu celular.

1. Crea cuenta gratis en [dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)
2. Copia tu authtoken de [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Instala y configura:
```bash
# Ubuntu/Debian
sudo snap install ngrok

# macOS
brew install ngrok

# Configurar authtoken
ngrok config add-authtoken TU_AUTHTOKEN
```

---

## Paso 2 — Crear el bot de Telegram

1. Abre Telegram y busca **@BotFather**
2. Escribele: `/newbot`
3. Nombre del bot: `Evva`
4. Username del bot (unico, termina en `bot`): `evva_dev_bot`
5. BotFather te responde con un token:
   ```
   7234567890:AAHdqTcvCH1vGWJxfSeofSDs0eJoksvvSDA
   ```
6. Guarda ese token — va en el `.env`

---

## Paso 3 — Obtener API keys

### Anthropic — Claude (requerido)

1. Ve a [console.anthropic.com](https://console.anthropic.com)
2. Crea cuenta → **API Keys** → **Create Key**
3. Copia la key: `sk-ant-...`
4. Agrega creditos ($5 minimo) en Plans & Billing

El modelo por defecto es **Haiku** (~$0.25/millon tokens). Para cambiar a Sonnet configura `LLM_MODEL=claude-sonnet-4-5` en el `.env`.

### Voyage AI — Embeddings (requerido)

1. Ve a [dash.voyageai.com](https://dash.voyageai.com)
2. Crea cuenta → **API Keys** → **Create new key**
3. Copia la key: `pa-...`

Tier gratuito: 50M tokens/mes.

### Groq — Transcripcion de voz (opcional, gratis)

Si quieres que el bot procese notas de voz:

1. Ve a [console.groq.com](https://console.groq.com)
2. Crea cuenta (gratis, sin tarjeta)
3. **API Keys** → **Create**
4. Copia la key: `gsk_...`

### Brave Search (opcional, gratis)

Para busqueda web:

1. Ve a [brave.com/search/api](https://brave.com/search/api/)
2. Plan gratuito: 2,000 busquedas/mes
3. Copia tu API key

### Google — Calendar y Gmail (opcional)

Para integracion con Google Calendar y Gmail:

#### 3.1 Crear proyecto en Google Cloud

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un nuevo proyecto (ej: "Evva")
3. Ve a **APIs & Services** → **Library**
4. Busca y habilita estas APIs:
   - **Google Calendar API**
   - **Gmail API**

#### 3.2 Crear credenciales OAuth

1. Ve a **APIs & Services** → **Credentials**
2. Clic en **Create Credentials** → **OAuth client ID**
3. Si te pide, configura la **OAuth consent screen** primero:
   - User Type: **External**
   - App name: "Evva" (o lo que quieras)
   - User support email: tu email
   - Scopes: no agregar ningun scope aqui
   - Test users: **agrega tu email** (importante para modo testing)
4. Vuelve a Credentials → **Create Credentials** → **OAuth client ID**
5. Application type: **Web application**
6. Name: "Evva Dev"
7. **Authorized redirect URIs**: agrega tu URI de callback:
   - Para desarrollo local: `http://localhost:3000/api/oauth/google/callback`
   - Para pruebas desde celular con ngrok: `https://TU-URL.ngrok-free.app/api/oauth/google/callback`
8. Clic en **Create**
9. Copia **Client ID** y **Client Secret**

**IMPORTANTE:** En **OAuth consent screen** → **Test users**, agrega el email de cada persona que vaya a probar. Sin esto, Google bloquea el acceso con error 403.

---

## Paso 4 — Configurar el proyecto

### 4.1 Clonar e instalar

```bash
git clone https://github.com/tu-usuario/evva.git
cd evva
pnpm install
```

### 4.2 Crear archivo de variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:

```env
NODE_ENV=development
PORT=3000

# Telegram (Paso 2)
TELEGRAM_BOT_TOKEN=7234567890:AAHdqTcvCH1vGWJxfSeofSDs0eJoksvvSDA
TELEGRAM_WEBHOOK_URL=
TELEGRAM_SECRET_TOKEN=

# Claude (Paso 3)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Modelo LLM (haiku = barato, sonnet = mejor calidad)
LLM_MODEL=claude-haiku-4-5-20251001

# Voyage AI (Paso 3)
VOYAGE_API_KEY=pa-...

# PostgreSQL
# Docker: postgresql://evva:evva@localhost:5432/evva
# Nativo: postgresql://localhost:5432/evva
# Con password: postgresql://usuario:password@localhost:5432/evva
DATABASE_URL=postgresql://evva:evva@localhost:5432/evva

# Redis
# Sin password: redis://localhost:6379/0
# Con password: redis://:tupassword@localhost:6379/0
REDIS_URL=redis://localhost:6379/0

# Groq — notas de voz (opcional)
GROQ_API_KEY=gsk_...

# Brave Search (opcional)
BRAVE_SEARCH_API_KEY=

# Google OAuth — Calendar + Gmail (opcional)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/google/callback
```

### 4.3 Ejecutar migraciones

```bash
pnpm db:migrate
```

Debes ver:
```
  → Aplicando 001_initial_schema.sql...
  ✓ 001_initial_schema.sql aplicada
  → Aplicando 002_notes_contacts.sql...
  ✓ 002_notes_contacts.sql aplicada
  → Aplicando 003_daily_briefing.sql...
  ✓ 003_daily_briefing.sql aplicada
  → Aplicando 004_oauth_tokens.sql...
  ✓ 004_oauth_tokens.sql aplicada
  → Aplicando 005_finances.sql...
  ✓ 005_finances.sql aplicada

Migraciones completadas.
```

---

## Paso 5 — Correr el proyecto

Necesitas **dos terminales**:

### Terminal 1 — Gateway (bot de Telegram)

```bash
pnpm build && cd apps/gateway && node dist/main.js
```

Debes ver:
```
[SchedulerService] Conectando a Redis: redis://:***@localhost:6379/0
[SchedulerService] Scheduler conectado a Redis
[TelegramService] Inicializando bot de Telegram...
[TelegramService] Bot iniciado con long polling
[Bootstrap] Evva Gateway corriendo en puerto 3000
```

### Terminal 2 — Worker (jobs asincronos)

```bash
cd apps/worker && node dist/main.js
```

Debes ver:
```
[ScheduledJobProcessor] ScheduledJobProcessor iniciado
[FactExtractionProcessor] FactExtractionProcessor iniciado
[DailyBriefingProcessor] DailyBriefingProcessor iniciado
[WorkerBootstrap] Evva Worker iniciado — procesando queues
```

### Terminal 3 — ngrok (solo si pruebas OAuth desde celular)

```bash
ngrok http 3000
```

Copia la URL que te da (ej: `https://abc123.ngrok-free.app`) y actualiza:
1. `.env`: `GOOGLE_REDIRECT_URI=https://abc123.ngrok-free.app/api/oauth/google/callback`
2. Google Cloud Console → Credentials → OAuth Client → agrega el mismo URI
3. Reinicia el gateway

---

## Paso 6 — Probar el bot

1. Abre Telegram → busca tu bot → escribe `/start`
2. Elige un nombre para tu asistente (ej: "Luna")
3. Prueba estas funcionalidades:

**Conversacion:**
```
Hola, ¿que puedes hacer?
```

**Memoria:**
```
Mi esposa se llama Laura y su cumpleanos es el 15 de marzo
```

**Recordatorios:**
```
Recuerdame en 2 minutos que tengo que llamar a Laura
```

**Notas y listas:**
```
Haz una lista del super: leche, huevos, pan, tortillas
```

**Contactos:**
```
Guarda el contacto de mi dentista: Dr. Lopez, 5512345678
```

**Finanzas:**
```
Agrega mi tarjeta BBVA Oro, terminacion 4523, corta el 15, pago el 5
Gaste $850 en el super con mi BBVA
¿Cuanto llevo gastado este mes?
```

**Notas de voz:**
Envia un audio y el bot lo transcribe y procesa.

**Fotos:**
Envia una foto de un recibo, menu, o documento.

**Google Calendar + Gmail** (si configuraste Google):
```
Conecta mi Google
¿Que tengo en mi agenda esta semana?
¿Que correos tengo sin leer?
Mandame un correo a ejemplo@gmail.com diciendo que llego tarde
```

---

## Problemas comunes

### "Credit balance is too low"
Recarga creditos en [console.anthropic.com](https://console.anthropic.com) → Plans & Billing. O cambia a Haiku: `LLM_MODEL=claude-haiku-4-5-20251001`

### "TELEGRAM_BOT_TOKEN no configurado"
Verifica que el token este completo en `.env`, sin espacios.

### "Missing DATABASE_URL"
Verifica `DATABASE_URL` en `.env`. Si usas Docker: `postgresql://evva:evva@localhost:5432/evva`

### "relation 'users' does not exist"
Corre las migraciones: `pnpm db:migrate`

### "could not create extension vector"
Si usas Docker con `pgvector/pgvector:pg16` ya viene incluido. Si es nativo: `sudo apt install postgresql-16-pgvector`

### "Error de conexion a Redis"
Verifica que Redis corra: `docker exec -it evva-redis redis-cli ping` (debe responder PONG).

### "redirect_uri_mismatch" en Google OAuth
El URI debe ser EXACTAMENTE igual en 3 lugares:
1. `.env` → `GOOGLE_REDIRECT_URI`
2. Google Cloud Console → Credentials → OAuth Client → Authorized redirect URIs
3. El puerto real del gateway (ver logs)

Si pruebas desde celular, usa ngrok y actualiza el URI con la URL de ngrok.

### "Gmail API has not been used in project"
Habilita la Gmail API en Google Cloud Console → APIs & Services → Library → busca "Gmail API" → Enable.

### "Acceso bloqueado: no ha completado verificacion"
En Google Cloud Console → OAuth consent screen → Test users, agrega el email del usuario.

### Bot no responde en Telegram
1. Verifica que el gateway corra sin errores
2. Verifica el token en `.env`
3. Si mataste el proceso anterior, otro proceso puede estar haciendo polling. Reinicia.

---

## Comandos utiles

```bash
pnpm build              # Compilar todo
pnpm test               # Correr tests (120 tests)
pnpm dev:gateway         # Gateway en modo watch
pnpm dev:worker          # Worker en modo watch
pnpm db:migrate          # Correr migraciones pendientes
pnpm typecheck           # Verificar tipos sin compilar
```

---

## Estructura de costos en desarrollo

| Servicio | Tier gratuito | Costo en dev |
|---|---|---|
| PostgreSQL (local) | — | $0 |
| Redis (local) | — | $0 |
| Voyage AI | 50M tokens/mes | $0 |
| Groq (Whisper) | 14,400 req/dia | $0 |
| Brave Search | 2,000 busquedas/mes | $0 |
| ngrok | 1 tunel gratis | $0 |
| Claude Haiku | — | ~$0.001/conversacion |
| Claude Sonnet | — | ~$0.01/conversacion |
| Google APIs | Cuota generosa | $0 |

**Total desarrollo: ~$5 USD** (creditos iniciales de Anthropic).
