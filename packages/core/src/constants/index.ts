// ============================================================
// Branding — configurable via APP_BRAND_NAME en .env
// ============================================================
export const BRAND = {
  get NAME() { return process.env.APP_BRAND_NAME ?? 'Evva'; },
  get NAME_LOWER() { return this.NAME.toLowerCase(); },
} as const;

// ============================================================
// Límites del sistema
// ============================================================
export const LIMITS = {
  // Cuántos mensajes recientes incluir como contexto
  CONVERSATION_WINDOW: 12,

  // Cuántos facts recuperar por búsqueda semántica
  MEMORY_RETRIEVAL_TOP_K: 5,

  // Longitud máxima de un fact en caracteres
  MEMORY_FACT_MAX_LENGTH: 500,

  // Caracteres máximos de un mensaje de Telegram (límite de la API)
  TELEGRAM_MAX_MESSAGE_LENGTH: 4096,

  // Tiempo máximo de espera para respuesta del LLM (ms)
  LLM_TIMEOUT_MS: 30_000,

  // Reintentos máximos para jobs fallidos
  JOB_MAX_ATTEMPTS: 3,
} as const;

// ============================================================
// Tokens especiales en prompts
// ============================================================
export const PROMPT_TOKENS = {
  FACTS_SECTION_START: '<memory_facts>',
  FACTS_SECTION_END: '</memory_facts>',
  HISTORY_SECTION_START: '<conversation_history>',
  HISTORY_SECTION_END: '</conversation_history>',
} as const;

// ============================================================
// Onboarding — mensajes del flujo de bienvenida
// ============================================================
export const ONBOARDING_MESSAGES = {
  WELCOME: (firstName: string) =>
    `Hola ${firstName}, soy tu nuevo asistente personal. Antes de empezar, ¿cómo quieres que me llame?`,

  NAME_CONFIRM: (name: string) =>
    `Me gusta. Seré ${name}. Voy a recordar todo lo que me cuentes y cuando lo necesites, yo te aviso. ¿Comenzamos?`,

  READY: (name: string) =>
    `Listo. Soy ${name} y estoy aquí cuando me necesites. Puedes contarme cosas importantes, pedirme que te recuerde algo, o preguntarme lo que sea. ¿En qué te ayudo hoy?`,
} as const;

// ============================================================
// Timezones disponibles (México primero)
// ============================================================
export const TIMEZONES = [
  'America/Mexico_City',
  'America/Monterrey',
  'America/Tijuana',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Buenos_Aires',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
  'UTC',
] as const;

export type Timezone = (typeof TIMEZONES)[number];

export const DEFAULT_TIMEZONE: Timezone = 'America/Mexico_City';
export const DEFAULT_LANGUAGE = 'es' as const;
