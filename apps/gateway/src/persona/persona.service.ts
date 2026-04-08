import { Injectable, Logger } from "@nestjs/common";
import type { Assistant, User } from "@evva/core";
import { buildSystemPrompt } from "@evva/ai";
import { MemoryService } from "../memory/memory.service.js";

@Injectable()
export class PersonaService {
  private readonly logger = new Logger(PersonaService.name);

  constructor(private readonly memoryService: MemoryService) {}

  async buildPromptForMessage(params: {
    user: User;
    assistant: Assistant;
    incomingMessage: string;
    skillInstructions: string[];
  }): Promise<string> {
    // Layer 1: Profile facts (always loaded)
    const profileFacts = await this.memoryService.getProfileFacts(
      params.user.id,
    );

    // Build profile context string for query enrichment
    const profileContext =
      profileFacts.length > 0
        ? profileFacts.map((f) => f.content).join(", ")
        : undefined;

    // Layer 2: Contextual facts (enriched semantic search)
    const contextFacts = await this.memoryService.searchContextualFacts({
      userId: params.user.id,
      query: params.incomingMessage,
      profileContext,
      limit: 8,
    });

    // Deduplicate: remove context facts that are already in profile
    const profileIds = new Set(profileFacts.map((f) => f.id));
    const uniqueContextFacts = contextFacts.filter(
      (f) => !profileIds.has(f.id),
    );

    this.logger.debug(
      `Building prompt for user ${params.user.id} with ${profileFacts.length} profile + ${uniqueContextFacts.length} context facts`,
    );

    return buildSystemPrompt({
      assistant: params.assistant,
      userFirstName: params.user.telegramFirstName,
      timezone: params.user.timezone,
      language: params.user.language,
      gender: params.user.gender,
      profileFacts,
      contextFacts: uniqueContextFacts,
      skillInstructions: params.skillInstructions,
    });
  }

  buildOnboardingPrompt(assistantName: string): string {
    return `Eres ${assistantName}, un asistente personal cálido y amigable.
Estás en el proceso de presentarte con un nuevo usuario.
Sé natural, breve y cercano. Habla en español informal (tuteo).
Tu objetivo es que el usuario se sienta cómodo y emocionado de tenerte como asistente.`;
  }
}
