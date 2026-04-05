import { Injectable, Logger } from '@nestjs/common';
import type { User, Assistant, Message } from '@evva/core';
import { generateSessionId, LIMITS } from '@evva/core';
import { saveMessage, getRecentMessages } from '@evva/database';
import { generateResponse } from '@evva/ai';
import { PersonaService } from '../persona/persona.service.js';
import { ToolsService } from '../tools/tools.service.js';
import { SchedulerService } from '../scheduler/scheduler.service.js';

export interface ConversationResult {
  reply: string;
  sessionId: string;
  tokensUsed: number;
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  // Cache de sessionId por usuario para agrupar mensajes de la misma sesión
  private readonly activeSessions = new Map<string, string>();

  constructor(
    private readonly personaService: PersonaService,
    private readonly toolsService: ToolsService,
    private readonly schedulerService: SchedulerService,
  ) {}

  // ============================================================
  // Procesa un mensaje entrante y devuelve la respuesta del agente
  // ============================================================

  async processMessage(params: {
    user: User;
    assistant: Assistant;
    incomingText: string;
    imageData?: Buffer;
    telegramMessageId?: number;
  }): Promise<ConversationResult> {
    const { user, assistant, incomingText } = params;

    // Resolver o crear sesión activa
    const sessionId = this.getOrCreateSession(user.id);

    this.logger.log(
      `Processing message for user ${user.id} | session ${sessionId}`,
    );

    // 1. Guardar mensaje del usuario
    const userMessage = await saveMessage({
      userId: user.id,
      sessionId,
      role: 'user',
      content: incomingText,
      metadata: {
        telegramMessageId: params.telegramMessageId,
      },
    });

    // 2. Cargar historial reciente
    const history = await getRecentMessages(user.id, LIMITS.CONVERSATION_WINDOW);

    // 3. Construir system prompt dinámico con memoria semántica
    const systemPrompt = await this.personaService.buildPromptForMessage({
      user,
      assistant,
      incomingMessage: incomingText,
    });

    // 4. Formatear historial para el LLM (excluir el mensaje actual que ya está al final)
    const historyForLLM = history
      .filter((m) => m.id !== userMessage.id)
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Agregar el mensaje actual (con imagen si existe)
    if (params.imageData) {
      historyForLLM.push({
        role: 'user',
        content: [
          { type: 'text', text: incomingText || 'Describe esta imagen.' },
          { type: 'image', image: params.imageData },
        ],
      } as any);
    } else {
      historyForLLM.push({ role: 'user', content: incomingText });
    }

    // 5. Construir tools disponibles para esta sesión
    const tools = this.toolsService.buildTools(user, assistant);

    // 6. Llamar al LLM
    const llmResponse = await generateResponse({
      systemPrompt,
      messages: historyForLLM,
      tools,
      maxTokens: 1024,
    });

    const replyText = llmResponse.text || 'No entendí bien, ¿puedes repetirlo?';

    // 7. Guardar respuesta del asistente
    await saveMessage({
      userId: user.id,
      sessionId,
      role: 'assistant',
      content: replyText,
      metadata: {
        tokensUsed: llmResponse.usage.totalTokens,
        modelUsed: 'claude-sonnet-4-5',
        toolsUsed: llmResponse.toolCalls?.map((tc) => tc.toolName),
      },
    });

    // 8. Encolar extracción de facts de forma asíncrona (no bloquea la respuesta)
    this.schedulerService
      .enqueueFactExtraction({
        userId: user.id,
        sessionId,
        messages: [
          ...historyForLLM,
          { role: 'assistant', content: replyText },
        ],
      })
      .catch((err) => {
        this.logger.error(`Failed to enqueue fact extraction: ${err}`);
      });

    this.logger.log(
      `Response generated for user ${user.id} | ${llmResponse.usage.totalTokens} tokens`,
    );

    return {
      reply: replyText,
      sessionId,
      tokensUsed: llmResponse.usage.totalTokens,
    };
  }

  // ============================================================
  // Gestión de sesiones activas
  // Una sesión agrupa mensajes de una conversación continua
  // Se reinicia si el usuario no escribe en 30 minutos
  // ============================================================

  private getOrCreateSession(userId: string): string {
    const existing = this.activeSessions.get(userId);
    if (existing) return existing;

    const newSession = generateSessionId(userId);
    this.activeSessions.set(userId, newSession);

    // Auto-expirar sesión después de 30 minutos de inactividad
    setTimeout(
      () => {
        if (this.activeSessions.get(userId) === newSession) {
          this.activeSessions.delete(userId);
          this.logger.debug(`Session expired for user ${userId}`);
        }
      },
      30 * 60 * 1000,
    );

    return newSession;
  }

  // Permite forzar una nueva sesión (ej: /reset command)
  resetSession(userId: string): void {
    this.activeSessions.delete(userId);
    this.logger.debug(`Session reset for user ${userId}`);
  }
}
