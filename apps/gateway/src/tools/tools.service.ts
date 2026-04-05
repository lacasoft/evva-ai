import { Injectable, Logger } from "@nestjs/common";
import type { Tool } from "ai";
import type { User, Assistant } from "@evva/core";
import { skillRegistry, type SkillContext } from "@evva/skills";
import { query } from "@evva/database";
import { CacheService } from "../cache/cache.service.js";
import { MemoryService } from "../memory/memory.service.js";
import { SchedulerService } from "../scheduler/scheduler.service.js";

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly schedulerService: SchedulerService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Builds all tools for a user session using the skill registry.
   * Only loads tools the user can actually use (OAuth connected, env configured).
   * Uses Redis cache for connected providers (5 min TTL).
   */
  async buildTools(
    user: User,
    assistant: Assistant,
  ): Promise<Record<string, Tool>> {
    const connectedProviders = await this.getConnectedProviders(user.id);
    const ctx: SkillContext = { user, assistant, connectedProviders };

    const tools = skillRegistry.buildAllTools(ctx);

    this.logger.debug(
      `Built ${Object.keys(tools).length} tools for user ${user.id} (providers: ${connectedProviders.join(",") || "none"})`,
    );

    return tools;
  }

  /**
   * Get prompt instructions for a specific user context.
   */
  async getPromptInstructions(
    user: User,
    assistant: Assistant,
  ): Promise<string[]> {
    const connectedProviders = await this.getConnectedProviders(user.id);
    const ctx: SkillContext = { user, assistant, connectedProviders };
    return skillRegistry.getPromptInstructions(ctx);
  }

  /**
   * Get a summary of all skills and their status.
   */
  getSkillsSummary() {
    return skillRegistry.getSummary();
  }

  /**
   * Check which OAuth providers the user has connected.
   * Cached in Redis for 5 minutes.
   */
  private async getConnectedProviders(userId: string): Promise<string[]> {
    const cacheKey = `user:${userId}:providers`;

    // Check cache first
    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached) return cached;

    try {
      const rows = await query(
        "SELECT DISTINCT provider FROM oauth_tokens WHERE user_id = $1",
        [userId],
      );
      const providers = rows.map((r) => r.provider as string);
      await this.cache.set(cacheKey, providers, 300); // 5 min
      return providers;
    } catch {
      return [];
    }
  }
}
