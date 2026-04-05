import { describe, it, expect, vi } from "vitest";

import {
  generateId,
  nowInTimezone,
  formatDateForUser,
  truncate,
  sanitizeTelegramMessage,
  generateSessionId,
  isValidAssistantName,
  normalizeAssistantName,
  EvvaError,
  isEvvaError,
} from "../utils/index";

import { LIMITS, ONBOARDING_MESSAGES, TIMEZONES } from "../constants/index";

// ============================================================
// generateId
// ============================================================
describe("generateId", () => {
  it("returns a valid UUID v4 string", () => {
    const id = generateId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("returns unique values on successive calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateId()));
    expect(ids.size).toBe(50);
  });
});

// ============================================================
// nowInTimezone
// ============================================================
describe("nowInTimezone", () => {
  it("returns a Date object", () => {
    const result = nowInTimezone("America/Mexico_City");
    expect(result).toBeInstanceOf(Date);
  });

  it("returns a valid (non-NaN) date", () => {
    const result = nowInTimezone("UTC");
    expect(result.getTime()).not.toBeNaN();
  });

  it("produces different representations for distant timezones", () => {
    // Freeze time so both calls see the same instant
    const fixed = new Date("2025-06-15T12:00:00Z");
    vi.useFakeTimers({ now: fixed });

    const tokyo = nowInTimezone("Asia/Tokyo"); // UTC+9
    const la = nowInTimezone("America/Los_Angeles"); // UTC-7

    // The hour component should differ
    expect(tokyo.getHours()).not.toBe(la.getHours());

    vi.useRealTimers();
  });
});

// ============================================================
// formatDateForUser
// ============================================================
describe("formatDateForUser", () => {
  const sampleDate = new Date("2025-03-15T14:30:00Z");

  it("returns a non-empty string", () => {
    const result = formatDateForUser(sampleDate, "America/Mexico_City");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("defaults to Spanish locale", () => {
    const result = formatDateForUser(sampleDate, "UTC");
    // Spanish day/month names typically contain lowercase accented letters
    // and the word "de" — just verify it is not purely numeric
    expect(result).toMatch(/[a-zA-Z]/);
  });

  it('uses English locale when language is "en"', () => {
    const result = formatDateForUser(sampleDate, "UTC", "en");
    // English months: January..December — at least one should appear
    const englishMonths = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const containsEnglishMonth = englishMonths.some((m) => result.includes(m));
    expect(containsEnglishMonth).toBe(true);
  });

  it("includes time components (hour and minute)", () => {
    const result = formatDateForUser(sampleDate, "UTC", "en");
    // Expect a colon separating hour:minute
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

// ============================================================
// truncate
// ============================================================
describe("truncate", () => {
  it("returns text unchanged when shorter than maxLength", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("returns text unchanged when exactly maxLength", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it('truncates and appends "..." when text exceeds maxLength', () => {
    const result = truncate("hello world", 8);
    expect(result).toBe("hello...");
    expect(result.length).toBe(8);
  });

  it("handles maxLength of 3 (minimum for ellipsis)", () => {
    expect(truncate("abcdef", 3)).toBe("...");
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });

  it("resulting string never exceeds maxLength", () => {
    const long = "a".repeat(1000);
    for (const max of [4, 10, 50, 100]) {
      expect(truncate(long, max).length).toBeLessThanOrEqual(max);
    }
  });
});

// ============================================================
// sanitizeTelegramMessage
// ============================================================
describe("sanitizeTelegramMessage", () => {
  it("escapes underscores", () => {
    expect(sanitizeTelegramMessage("hello_world")).toBe("hello\\_world");
  });

  it("escapes asterisks", () => {
    expect(sanitizeTelegramMessage("*bold*")).toBe("\\*bold\\*");
  });

  it("escapes square brackets", () => {
    expect(sanitizeTelegramMessage("[link]")).toBe("\\[link\\]");
  });

  it("escapes parentheses", () => {
    expect(sanitizeTelegramMessage("(url)")).toBe("\\(url\\)");
  });

  it("escapes tilde", () => {
    expect(sanitizeTelegramMessage("~strike~")).toBe("\\~strike\\~");
  });

  it("escapes backtick", () => {
    expect(sanitizeTelegramMessage("`code`")).toBe("\\`code\\`");
  });

  it("escapes hash, plus, minus, equals, pipe, curly braces, dot, exclamation", () => {
    expect(sanitizeTelegramMessage("#+=-|{}.!")).toBe(
      "\\#\\+\\=\\-\\|\\{\\}\\.\\!",
    );
  });

  it("escapes greater-than sign", () => {
    expect(sanitizeTelegramMessage("> quote")).toBe("\\> quote");
  });

  it("escapes backslash itself", () => {
    expect(sanitizeTelegramMessage("a\\b")).toBe("a\\\\b");
  });

  it("leaves plain alphanumeric text unchanged", () => {
    expect(sanitizeTelegramMessage("Hello World 123")).toBe("Hello World 123");
  });

  it("handles empty string", () => {
    expect(sanitizeTelegramMessage("")).toBe("");
  });

  it("handles multiple special chars in sequence", () => {
    const result = sanitizeTelegramMessage("_*~");
    expect(result).toBe("\\_\\*\\~");
  });
});

// ============================================================
// generateSessionId
// ============================================================
describe("generateSessionId", () => {
  it("starts with the first 8 characters of userId", () => {
    const id = generateSessionId("abcdefghijklmnop");
    expect(id).toMatch(/^abcdefgh-/);
  });

  it("contains a dash separator", () => {
    const id = generateSessionId("user12345678");
    expect(id).toContain("-");
  });

  it("ends with a numeric timestamp", () => {
    const id = generateSessionId("testuser");
    const parts = id.split("-");
    const timestamp = parts[parts.length - 1];
    expect(Number(timestamp)).toBeGreaterThan(0);
    expect(Number(timestamp)).not.toBeNaN();
  });

  it("handles short userId (fewer than 8 chars)", () => {
    const id = generateSessionId("abc");
    expect(id.startsWith("abc-")).toBe(true);
  });

  it("produces different ids for successive calls (different timestamp)", () => {
    // Use fake timers to guarantee different timestamps
    vi.useFakeTimers({ now: 1000 });
    const id1 = generateSessionId("user1234");
    vi.advanceTimersByTime(1);
    const id2 = generateSessionId("user1234");
    expect(id1).not.toBe(id2);
    vi.useRealTimers();
  });
});

// ============================================================
// isValidAssistantName
// ============================================================
describe("isValidAssistantName", () => {
  it("accepts a simple name", () => {
    expect(isValidAssistantName("Luna")).toBe(true);
  });

  it("accepts names with spaces", () => {
    expect(isValidAssistantName("Mi Asistente")).toBe(true);
  });

  it("accepts names with accented characters", () => {
    expect(isValidAssistantName("Rene")).toBe(true);
    expect(isValidAssistantName("Rene")).toBe(true);
  });

  it("accepts names with numbers", () => {
    expect(isValidAssistantName("Bot 3000")).toBe(true);
  });

  it("accepts exactly 2 characters (minimum)", () => {
    expect(isValidAssistantName("AB")).toBe(true);
  });

  it("accepts exactly 20 characters (maximum)", () => {
    expect(isValidAssistantName("A".repeat(20))).toBe(true);
  });

  it("rejects single character", () => {
    expect(isValidAssistantName("A")).toBe(false);
  });

  it("rejects 21 characters", () => {
    expect(isValidAssistantName("A".repeat(21))).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidAssistantName("")).toBe(false);
  });

  it("rejects names with special characters", () => {
    expect(isValidAssistantName("Bot!")).toBe(false);
    expect(isValidAssistantName("Bot@Home")).toBe(false);
    expect(isValidAssistantName("Bot#1")).toBe(false);
    expect(isValidAssistantName("my_bot")).toBe(false);
  });

  it("trims whitespace before validation", () => {
    expect(isValidAssistantName("  Luna  ")).toBe(true);
  });

  it("rejects whitespace-only strings that trim to below minimum", () => {
    expect(isValidAssistantName("   ")).toBe(false);
  });
});

// ============================================================
// normalizeAssistantName
// ============================================================
describe("normalizeAssistantName", () => {
  it("capitalizes the first letter of a single word", () => {
    expect(normalizeAssistantName("luna")).toBe("Luna");
  });

  it("capitalizes the first letter of each word", () => {
    expect(normalizeAssistantName("mi asistente")).toBe("Mi Asistente");
  });

  it("lowercases the rest of each word", () => {
    expect(normalizeAssistantName("LUNA")).toBe("Luna");
    expect(normalizeAssistantName("MI ASISTENTE")).toBe("Mi Asistente");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeAssistantName("  luna  ")).toBe("Luna");
  });

  it("handles single character words", () => {
    expect(normalizeAssistantName("a b c")).toBe("A B C");
  });

  it("handles already normalized names", () => {
    expect(normalizeAssistantName("Luna Bot")).toBe("Luna Bot");
  });
});

// ============================================================
// EvvaError
// ============================================================
describe("EvvaError", () => {
  it("is an instance of Error", () => {
    const err = new EvvaError("fail", "ERR_TEST");
    expect(err).toBeInstanceOf(Error);
  });

  it("is an instance of EvvaError", () => {
    const err = new EvvaError("fail", "ERR_TEST");
    expect(err).toBeInstanceOf(EvvaError);
  });

  it("stores message correctly", () => {
    const err = new EvvaError("something broke", "ERR_BROKEN");
    expect(err.message).toBe("something broke");
  });

  it("stores code correctly", () => {
    const err = new EvvaError("fail", "ERR_CODE_42");
    expect(err.code).toBe("ERR_CODE_42");
  });

  it('has name set to "EvvaError"', () => {
    const err = new EvvaError("fail", "ERR");
    expect(err.name).toBe("EvvaError");
  });

  it("stores optional context", () => {
    const ctx = { userId: "123", action: "test" };
    const err = new EvvaError("fail", "ERR", ctx);
    expect(err.context).toEqual(ctx);
  });

  it("context is undefined when not provided", () => {
    const err = new EvvaError("fail", "ERR");
    expect(err.context).toBeUndefined();
  });

  it("has a stack trace", () => {
    const err = new EvvaError("fail", "ERR");
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("EvvaError");
  });
});

// ============================================================
// isEvvaError
// ============================================================
describe("isEvvaError", () => {
  it("returns true for EvvaError instances", () => {
    const err = new EvvaError("fail", "ERR");
    expect(isEvvaError(err)).toBe(true);
  });

  it("returns false for plain Error", () => {
    expect(isEvvaError(new Error("nope"))).toBe(false);
  });

  it("returns false for null", () => {
    expect(isEvvaError(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isEvvaError(undefined)).toBe(false);
  });

  it("returns false for a string", () => {
    expect(isEvvaError("error")).toBe(false);
  });

  it("returns false for a plain object with similar shape", () => {
    const fake = { message: "fail", code: "ERR", name: "EvvaError" };
    expect(isEvvaError(fake)).toBe(false);
  });
});

// ============================================================
// LIMITS constant
// ============================================================
describe("LIMITS", () => {
  it("has CONVERSATION_WINDOW as a positive number", () => {
    expect(LIMITS.CONVERSATION_WINDOW).toBeGreaterThan(0);
    expect(typeof LIMITS.CONVERSATION_WINDOW).toBe("number");
  });

  it("has MEMORY_RETRIEVAL_TOP_K as a positive number", () => {
    expect(LIMITS.MEMORY_RETRIEVAL_TOP_K).toBeGreaterThan(0);
  });

  it("has MEMORY_FACT_MAX_LENGTH as a positive number", () => {
    expect(LIMITS.MEMORY_FACT_MAX_LENGTH).toBeGreaterThan(0);
  });

  it("has TELEGRAM_MAX_MESSAGE_LENGTH set to 4096", () => {
    expect(LIMITS.TELEGRAM_MAX_MESSAGE_LENGTH).toBe(4096);
  });

  it("has LLM_TIMEOUT_MS as a positive number (at least 1 second)", () => {
    expect(LIMITS.LLM_TIMEOUT_MS).toBeGreaterThanOrEqual(1000);
  });

  it("has JOB_MAX_ATTEMPTS as a positive number", () => {
    expect(LIMITS.JOB_MAX_ATTEMPTS).toBeGreaterThan(0);
  });

  it("contains all expected keys", () => {
    const expectedKeys = [
      "CONVERSATION_WINDOW",
      "MEMORY_RETRIEVAL_TOP_K",
      "MEMORY_FACT_MAX_LENGTH",
      "TELEGRAM_MAX_MESSAGE_LENGTH",
      "LLM_TIMEOUT_MS",
      "JOB_MAX_ATTEMPTS",
    ];
    for (const key of expectedKeys) {
      expect(LIMITS).toHaveProperty(key);
    }
  });
});

// ============================================================
// ONBOARDING_MESSAGES
// ============================================================
describe("ONBOARDING_MESSAGES", () => {
  it("WELCOME returns a string containing the first name", () => {
    const msg = ONBOARDING_MESSAGES.WELCOME("Carlos");
    expect(typeof msg).toBe("string");
    expect(msg).toContain("Carlos");
  });

  it("NAME_CONFIRM returns a string containing the assistant name", () => {
    const msg = ONBOARDING_MESSAGES.NAME_CONFIRM("Luna");
    expect(typeof msg).toBe("string");
    expect(msg).toContain("Luna");
  });

  it("READY returns a string containing the assistant name", () => {
    const msg = ONBOARDING_MESSAGES.READY("Luna");
    expect(typeof msg).toBe("string");
    expect(msg).toContain("Luna");
  });

  it("all message functions return non-empty strings", () => {
    expect(ONBOARDING_MESSAGES.WELCOME("A").length).toBeGreaterThan(0);
    expect(ONBOARDING_MESSAGES.NAME_CONFIRM("A").length).toBeGreaterThan(0);
    expect(ONBOARDING_MESSAGES.READY("A").length).toBeGreaterThan(0);
  });
});

// ============================================================
// TIMEZONES
// ============================================================
describe("TIMEZONES", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(TIMEZONES)).toBe(true);
    expect(TIMEZONES.length).toBeGreaterThan(0);
  });

  it("contains America/Mexico_City", () => {
    expect(TIMEZONES).toContain("America/Mexico_City");
  });

  it("contains UTC", () => {
    expect(TIMEZONES).toContain("UTC");
  });

  it("all entries are non-empty strings", () => {
    for (const tz of TIMEZONES) {
      expect(typeof tz).toBe("string");
      expect(tz.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate entries", () => {
    const unique = new Set(TIMEZONES);
    expect(unique.size).toBe(TIMEZONES.length);
  });
});
