import { randomUUID } from 'crypto';

// ============================================================
// ID generation
// ============================================================
export function generateId(): string {
  return randomUUID();
}

// ============================================================
// Date utils
// ============================================================
export function nowInTimezone(timezone: string): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
}

export function formatDateForUser(date: Date, timezone: string, language = 'es'): string {
  return date.toLocaleDateString(language === 'es' ? 'es-MX' : 'en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================
// Text utils
// ============================================================
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function sanitizeTelegramMessage(text: string): string {
  // Escape caracteres especiales de MarkdownV2
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

// ============================================================
// Session utils
// ============================================================
export function generateSessionId(userId: string): string {
  const timestamp = Date.now();
  return `${userId.slice(0, 8)}-${timestamp}`;
}

// ============================================================
// Validation utils
// ============================================================
export function isValidAssistantName(name: string): boolean {
  const trimmed = name.trim();
  // Entre 2 y 20 caracteres, solo letras (con acentos), números y espacios
  return /^[\p{L}\p{N} ]{2,20}$/u.test(trimmed);
}

export function normalizeAssistantName(name: string): string {
  return name.trim().split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

// ============================================================
// Error utils
// ============================================================
export class EvvaError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EvvaError';
  }
}

export function isEvvaError(error: unknown): error is EvvaError {
  return error instanceof EvvaError;
}
