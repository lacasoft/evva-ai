import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  buildConversationMessages,
  buildFactExtractionPrompt,
  buildProactiveMessagePrompt,
} from "../prompts/builder.js";
import type { Assistant, MemoryFact, Message } from "@evva/core";

// ---------------------------------------------------------------------------
// Helpers — mock factories
// ---------------------------------------------------------------------------

function createMockAssistant(overrides: Partial<Assistant> = {}): Assistant {
  return {
    id: "ast-1",
    userId: "usr-1",
    name: "Luna",
    personalityBase: "Eres Luna, una asistente amigable y servicial.",
    learnedPreferences: "",
    onboardingCompleted: true,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

function createMockFact(overrides: Partial<MemoryFact> = {}): MemoryFact {
  return {
    id: "fact-1",
    userId: "usr-1",
    content: "El usuario tiene un perro llamado Rocky",
    category: "relationship",
    importance: 0.8,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

function createMockMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    userId: "usr-1",
    sessionId: "ses-1",
    role: "user",
    content: "Hola, buenos dias",
    createdAt: new Date("2025-01-01"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

describe("buildSystemPrompt", () => {
  it("includes the assistant personalityBase", () => {
    const assistant = createMockAssistant();
    const result = buildSystemPrompt({
      assistant,
      timezone: "America/Mexico_City",
      language: "es",
      profileFacts: [],
      contextFacts: [],
    });

    expect(result).toContain(assistant.personalityBase);
  });

  it("includes learned preferences when they are not empty", () => {
    const assistant = createMockAssistant({
      learnedPreferences: "Prefiere respuestas cortas",
    });
    const result = buildSystemPrompt({
      assistant,
      timezone: "America/Mexico_City",
      language: "es",
      profileFacts: [],
      contextFacts: [],
    });

    expect(result).toContain("Preferencias del usuario");
    expect(result).toContain("Prefiere respuestas cortas");
  });

  it("omits learned preferences section when empty", () => {
    const result = buildSystemPrompt({
      assistant: createMockAssistant({ learnedPreferences: "" }),
      timezone: "America/Mexico_City",
      language: "es",
      profileFacts: [],
      contextFacts: [],
    });

    expect(result).not.toContain("Preferencias del usuario");
  });

  it("omits learned preferences section when whitespace-only", () => {
    const result = buildSystemPrompt({
      assistant: createMockAssistant({ learnedPreferences: "   " }),
      timezone: "America/Mexico_City",
      language: "es",
      profileFacts: [],
      contextFacts: [],
    });

    expect(result).not.toContain("Preferencias del usuario");
  });

  it("includes memory facts in context section", () => {
    const facts = [
      createMockFact({ content: "Tiene un perro llamado Rocky" }),
      createMockFact({ id: "fact-2", content: "Vive en Guadalajara" }),
    ];

    const result = buildSystemPrompt({
      assistant: createMockAssistant(),
      timezone: "America/Mexico_City",
      language: "es",
      profileFacts: [],
      contextFacts: facts,
    });

    expect(result).toContain("<context_memory>");
    expect(result).toContain("</context_memory>");
    expect(result).toContain("- Tiene un perro llamado Rocky");
    expect(result).toContain("- Vive en Guadalajara");
  });

  it("omits facts section when no facts are provided", () => {
    const result = buildSystemPrompt({
      assistant: createMockAssistant(),
      timezone: "America/Mexico_City",
      language: "es",
      profileFacts: [],
      contextFacts: [],
    });

    expect(result).not.toContain("<profile>");
    expect(result).not.toContain("<context_memory>");
  });

  it("includes profile and context sections separately", () => {
    const profileFact = {
      id: "p1", userId: "u1", content: "Esposa se llama Maria",
      category: "relationship" as const, importance: 0.9,
      createdAt: new Date(), updatedAt: new Date(),
    };
    const contextFact = {
      id: "c1", userId: "u1", content: "Le gusta el cafe",
      category: "preference" as const, importance: 0.5,
      createdAt: new Date(), updatedAt: new Date(),
    };
    const result = buildSystemPrompt({
      assistant: createMockAssistant(),
      timezone: "America/Mexico_City",
      language: "es",
      profileFacts: [profileFact],
      contextFacts: [contextFact],
    });
    expect(result).toContain("<profile>");
    expect(result).toContain("Esposa se llama Maria");
    expect(result).toContain("<context_memory>");
    expect(result).toContain("Le gusta el cafe");
  });

  it("includes current date/time text", () => {
    const result = buildSystemPrompt({
      assistant: createMockAssistant(),
      timezone: "America/Mexico_City",
      language: "es",
      profileFacts: [],
      contextFacts: [],
    });

    expect(result).toContain("Fecha y hora actual para el usuario:");
  });

  it("includes skill instructions when provided", () => {
    const result = buildSystemPrompt({
      assistant: createMockAssistant(),
      timezone: "America/Mexico_City",
      language: "es",
      profileFacts: [],
      contextFacts: [],
      skillInstructions: [
        "- save_fact: Guarda hechos del usuario",
        "- get_weather: Clima actual",
      ],
    });

    expect(result).toContain("save_fact");
    expect(result).toContain("get_weather");
    expect(result).toContain("Capacidades disponibles");
  });

  it("includes proactive behavior block even without skill instructions", () => {
    const result = buildSystemPrompt({
      assistant: createMockAssistant(),
      timezone: "America/Mexico_City",
      language: "es",
      profileFacts: [],
      contextFacts: [],
    });

    expect(result).toContain("PROACTIVO");
  });
});

// ---------------------------------------------------------------------------
// buildConversationMessages
// ---------------------------------------------------------------------------

describe("buildConversationMessages", () => {
  it("maps user and assistant messages to {role, content}", () => {
    const messages: Message[] = [
      createMockMessage({ role: "user", content: "Hola" }),
      createMockMessage({
        id: "msg-2",
        role: "assistant",
        content: "Buenos dias!",
      }),
    ];

    const result = buildConversationMessages(messages);

    expect(result).toEqual([
      { role: "user", content: "Hola" },
      { role: "assistant", content: "Buenos dias!" },
    ]);
  });

  it("filters out system messages", () => {
    const messages: Message[] = [
      createMockMessage({ role: "system", content: "System prompt" }),
      createMockMessage({ id: "msg-2", role: "user", content: "Hola" }),
      createMockMessage({ id: "msg-3", role: "assistant", content: "Hola!" }),
    ];

    const result = buildConversationMessages(messages);

    expect(result).toHaveLength(2);
    expect(result.every((m) => m.role !== "system")).toBe(true);
  });

  it("returns empty array for empty input", () => {
    expect(buildConversationMessages([])).toEqual([]);
  });

  it("returns empty array when all messages are system", () => {
    const messages: Message[] = [
      createMockMessage({ role: "system", content: "a" }),
      createMockMessage({ id: "msg-2", role: "system", content: "b" }),
    ];

    expect(buildConversationMessages(messages)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildFactExtractionPrompt
// ---------------------------------------------------------------------------

describe("buildFactExtractionPrompt", () => {
  it("includes formatted conversation with role labels", () => {
    const messages = [
      { role: "user", content: "Tengo un gato llamado Michi" },
      { role: "assistant", content: "Que lindo nombre!" },
    ];

    const result = buildFactExtractionPrompt(messages);

    expect(result).toContain("Usuario: Tengo un gato llamado Michi");
    expect(result).toContain("Asistente: Que lindo nombre!");
  });

  it("contains the expected JSON schema description", () => {
    const result = buildFactExtractionPrompt([
      { role: "user", content: "test" },
    ]);

    expect(result).toContain('"facts"');
    expect(result).toContain('"content"');
    expect(result).toContain('"category"');
    expect(result).toContain('"importance"');
  });

  it("includes category options", () => {
    const result = buildFactExtractionPrompt([
      { role: "user", content: "test" },
    ]);

    expect(result).toContain("personal");
    expect(result).toContain("relationship");
    expect(result).toContain("work");
    expect(result).toContain("preference");
    expect(result).toContain("goal");
    expect(result).toContain("reminder");
  });

  it("includes empty facts fallback instruction", () => {
    const result = buildFactExtractionPrompt([
      { role: "user", content: "test" },
    ]);

    expect(result).toContain('{"facts": []}');
  });
});

// ---------------------------------------------------------------------------
// buildProactiveMessagePrompt
// ---------------------------------------------------------------------------

describe("buildProactiveMessagePrompt", () => {
  it("includes assistant name and user first name", () => {
    const result = buildProactiveMessagePrompt({
      assistantName: "Luna",
      userFirstName: "Carlos",
      reminderMessage: "Tomar medicamento",
      timezone: "America/Mexico_City",
      language: "es",
    });

    expect(result).toContain("Eres Luna");
    expect(result).toContain("Carlos");
  });

  it("includes the reminder message in quotes", () => {
    const result = buildProactiveMessagePrompt({
      assistantName: "Luna",
      userFirstName: "Carlos",
      reminderMessage: "Reunion a las 3pm",
      timezone: "America/Mexico_City",
      language: "es",
    });

    expect(result).toContain('"Reunion a las 3pm"');
  });

  it("uses fallback when userFirstName is undefined", () => {
    const result = buildProactiveMessagePrompt({
      assistantName: "Luna",
      reminderMessage: "test",
      timezone: "America/Mexico_City",
      language: "es",
    });

    expect(result).toContain("tu usuario");
  });

  it("includes additional context when provided", () => {
    const result = buildProactiveMessagePrompt({
      assistantName: "Luna",
      userFirstName: "Carlos",
      reminderMessage: "test",
      additionalContext: "El usuario suele estar ocupado por las tardes",
      timezone: "America/Mexico_City",
      language: "es",
    });

    expect(result).toContain(
      "Contexto adicional: El usuario suele estar ocupado por las tardes",
    );
  });

  it("omits additional context line when not provided", () => {
    const result = buildProactiveMessagePrompt({
      assistantName: "Luna",
      userFirstName: "Carlos",
      reminderMessage: "test",
      timezone: "America/Mexico_City",
      language: "es",
    });

    expect(result).not.toContain("Contexto adicional:");
  });
});
