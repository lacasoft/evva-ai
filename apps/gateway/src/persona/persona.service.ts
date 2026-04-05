import { Injectable, Logger } from "@nestjs/common";
import type { Assistant, User } from "@evva/core";
import { buildSystemPrompt } from "@evva/ai";
import { skillRegistry } from "@evva/skills";
import { MemoryService } from "../memory/memory.service.js";

@Injectable()
export class PersonaService {
  private readonly logger = new Logger(PersonaService.name);

  constructor(private readonly memoryService: MemoryService) {}

  // ============================================================
  // Construye el system prompt completo para una conversación
  // ============================================================

  async buildPromptForMessage(params: {
    user: User;
    assistant: Assistant;
    incomingMessage: string;
  }): Promise<string> {
    // Búsqueda semántica de facts relevantes para el mensaje actual
    const relevantFacts = await this.memoryService.searchRelevantFacts({
      userId: params.user.id,
      query: params.incomingMessage,
      limit: 5,
    });

    this.logger.debug(
      `Building prompt for user ${params.user.id} with ${relevantFacts.length} relevant facts`,
    );

    return buildSystemPrompt({
      assistant: params.assistant,
      userFirstName: params.user.telegramFirstName,
      timezone: params.user.timezone,
      language: params.user.language,
      relevantFacts,
      skillInstructions: skillRegistry.getPromptInstructions(),
    });
  }

  // ============================================================
  // Construye un prompt simple sin búsqueda semántica
  // (para onboarding, donde no hay facts aún)
  // ============================================================

  buildOnboardingPrompt(assistantName: string): string {
    return `Eres ${assistantName}, un asistente personal cálido y amigable.
Estás en el proceso de presentarte con un nuevo usuario.
Sé natural, breve y cercano. Habla en español informal (tuteo).
Tu objetivo es que el usuario se sienta cómodo y emocionado de tenerte como asistente.`;
  }
}
