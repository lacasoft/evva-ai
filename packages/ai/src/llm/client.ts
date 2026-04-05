import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, streamText, type CoreMessage, type Tool } from "ai";
import { LIMITS } from "@evva/core";

// ============================================================
// Cliente Anthropic
// ============================================================

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY environment variable.");
  }
  return createAnthropic({ apiKey });
}

// ============================================================
// Tipos
// ============================================================

export interface LLMRequest {
  systemPrompt: string;
  messages: CoreMessage[];
  tools?: Record<string, Tool>;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  text: string;
  toolCalls?: ToolCallResult[];
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ToolCallResult {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface StreamChunk {
  type: "text" | "tool_call" | "finish";
  content?: string;
  toolCall?: ToolCallResult;
}

// ============================================================
// generateResponse — para mensajes que requieren respuesta completa
// ============================================================

export async function generateResponse(
  request: LLMRequest,
): Promise<LLMResponse> {
  const anthropic = getAnthropicClient();

  const result = await generateText({
    model: anthropic(process.env.LLM_MODEL ?? "claude-haiku-4-5-20251001"),
    system: request.systemPrompt,
    messages: request.messages,
    tools: request.tools,
    maxTokens: request.maxTokens ?? 1024,
    temperature: request.temperature ?? 0.7,
    maxRetries: 2,
    maxSteps: 3, // Permite tool call → resultado → respuesta final
    abortSignal: AbortSignal.timeout(LIMITS.LLM_TIMEOUT_MS),
  });

  const toolCalls: ToolCallResult[] =
    result.toolCalls?.map((tc) => ({
      toolName: tc.toolName,
      args: tc.args as Record<string, unknown>,
    })) ?? [];

  return {
    text: result.text,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    finishReason: result.finishReason,
    usage: {
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
    },
  };
}

// ============================================================
// streamResponse — para experiencia más fluida en Telegram
// ============================================================

export async function* streamResponse(
  request: LLMRequest,
): AsyncGenerator<StreamChunk> {
  const anthropic = getAnthropicClient();

  const result = streamText({
    model: anthropic(process.env.LLM_MODEL ?? "claude-haiku-4-5-20251001"),
    system: request.systemPrompt,
    messages: request.messages,
    tools: request.tools,
    maxTokens: request.maxTokens ?? 1024,
    temperature: request.temperature ?? 0.7,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(LIMITS.LLM_TIMEOUT_MS),
  });

  for await (const chunk of result.textStream) {
    yield { type: "text", content: chunk };
  }

  const finalResult = await result;

  const toolCalls = await finalResult.toolCalls;
  if (toolCalls && toolCalls.length > 0) {
    for (const tc of toolCalls) {
      yield {
        type: "tool_call",
        toolCall: {
          toolName: tc.toolName,
          args: tc.args as Record<string, unknown>,
        },
      };
    }
  }

  yield { type: "finish" };
}

// ============================================================
// Modelos disponibles
// ============================================================

export const MODELS = {
  // Para desarrollo — económico y rápido
  DEFAULT: "claude-haiku-4-5-20251001",
  // Para conversación general — balance costo/capacidad
  SMART: "claude-sonnet-4-5",
  // Para tareas simples y rápidas
  FAST: "claude-haiku-4-5-20251001",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];
