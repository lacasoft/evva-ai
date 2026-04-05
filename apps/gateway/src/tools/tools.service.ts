import { Injectable, Logger } from "@nestjs/common";
import type { Tool } from "ai";
import type { User, Assistant } from "@evva/core";
import { skillRegistry } from "@evva/skills";
import { MemoryService } from "../memory/memory.service.js";
import { SchedulerService } from "../scheduler/scheduler.service.js";

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly schedulerService: SchedulerService,
  ) {}

  /**
   * Builds all tools for a user session using the skill registry.
   * Each skill contributes its tools based on availability and config.
   */
  buildTools(user: User, assistant: Assistant): Record<string, Tool> {
    const ctx = { user, assistant };

    // Get all tools from enabled skills
    const tools = skillRegistry.buildAllTools(ctx);

    this.logger.debug(
      `Built ${Object.keys(tools).length} tools from ${skillRegistry.getEnabled().length} skills for user ${user.id}`,
    );

    return tools;
  }

  /**
   * Get prompt instructions from all enabled skills.
   */
  getPromptInstructions(): string[] {
    return skillRegistry.getPromptInstructions();
  }

  /**
   * Get a summary of all skills and their status.
   */
  getSkillsSummary() {
    return skillRegistry.getSummary();
  }
}
