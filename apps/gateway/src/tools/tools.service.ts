import { Injectable, Logger } from "@nestjs/common";
import type { Tool } from "ai";
import type { User, Assistant } from "@evva/core";
import {
  skillRegistry,
  classifyIntent,
  type SkillContext,
  buildRuntimeTools,
} from "@evva/skills";
import { query, getUserRuntimeSkills } from "@evva/database";
import { CacheService } from "../cache/cache.service.js";
import { MemoryService } from "../memory/memory.service.js";
import { SchedulerService } from "../scheduler/scheduler.service.js";

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);
  private readonly sessionSkills = new Map<string, Set<string>>();

  constructor(
    private readonly memoryService: MemoryService,
    private readonly schedulerService: SchedulerService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Builds tools AND prompt instructions in a single call.
   * Queries connected providers only once (cached in Redis).
   */
  async buildToolsAndInstructions(
    user: User,
    assistant: Assistant,
    message: string,
  ): Promise<{ tools: Record<string, Tool>; promptInstructions: string[] }> {
    const connectedProviders = await this.getConnectedProviders(user.id);
    const ctx: SkillContext = {
      user,
      assistant,
      connectedProviders,
      services: {
        scheduleReminder: (params) =>
          this.schedulerService.scheduleReminder(params),
      },
    };

    // Intent-based filtering
    const skillNames = classifyIntent(message, skillRegistry.getEnabled());

    // Session persistence: inherit previous turn's skills
    const prevSkills = this.sessionSkills.get(user.id);
    if (prevSkills) {
      for (const name of prevSkills) skillNames.add(name);
    }
    this.sessionSkills.set(user.id, skillNames);

    const tools = skillRegistry.buildFilteredTools(ctx, skillNames);
    const promptInstructions = skillRegistry.getFilteredPromptInstructions(
      ctx,
      skillNames,
    );

    // Load user's runtime skills (declarative HTTP-based skills)
    try {
      const runtimeSkills = await getUserRuntimeSkills(user.id);
      for (const rs of runtimeSkills) {
        const runtimeTools = buildRuntimeTools(rs.config);
        Object.assign(tools, runtimeTools);
        promptInstructions.push(
          ...rs.config.tools.map(
            (t) => `- ${t.name}: ${t.description} (runtime skill)`,
          ),
        );
      }
    } catch (err) {
      this.logger.error(`Failed to load runtime skills: ${err}`);
    }

    this.logger.debug(
      `Built ${Object.keys(tools).length} tools from ${skillNames.size} skills for user ${user.id}`,
    );

    return { tools, promptInstructions };
  }

  getSkillsSummary() {
    return skillRegistry.getSummary();
  }

  private async getConnectedProviders(userId: string): Promise<string[]> {
    const cacheKey = `user:${userId}:providers`;
    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached) return cached;

    try {
      const rows = await query(
        "SELECT DISTINCT provider FROM oauth_tokens WHERE user_id = $1",
        [userId],
      );
      const providers = rows.map((r) => r.provider as string);
      await this.cache.set(cacheKey, providers, 300);
      return providers;
    } catch (err) {
      this.logger.error(`Failed to get connected providers: ${err}`);
      return [];
    }
  }
}
