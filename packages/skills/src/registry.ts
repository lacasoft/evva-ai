import type { Tool } from "ai";
import type { AgeRange } from "@evva/core";
import type { SkillContext, SkillDefinition } from "./base-skill.js";

export class SkillRegistry {
  private skills = new Map<string, SkillDefinition>();
  private enabledCache: SkillDefinition[] | null = null;

  /** Register a skill */
  register(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill);
  }

  /** Get all registered skills */
  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /** Get skills available for a specific profile */
  getForProfile(profile: AgeRange): SkillDefinition[] {
    return this.getAll().filter((s) => s.forProfiles.includes(profile));
  }

  /** Check which skills are currently enabled (env vars present). Cached after first call. */
  getEnabled(): SkillDefinition[] {
    if (this.enabledCache) return this.enabledCache;
    this.enabledCache = this.getAll().filter((skill) => {
      if (skill.requiredEnv) {
        return skill.requiredEnv.every((key) => !!process.env[key]);
      }
      return true;
    });
    return this.enabledCache;
  }

  /**
   * Get skills that are fully available for a user context.
   * Filters out OAuth skills where the user hasn't connected the provider.
   * Keeps the connect_* tool for unconnected OAuth skills.
   */
  getAvailableForUser(ctx: SkillContext): SkillDefinition[] {
    const connected = ctx.connectedProviders ?? [];
    return this.getEnabled().filter((skill) => {
      // Non-OAuth skills are always available
      if (!skill.requiresOAuth) return true;
      // OAuth skills are available if the user has connected that provider
      return connected.includes(skill.requiresOAuth);
    });
  }

  /**
   * Build tools for a user context.
   * - Fully connected skills: all tools
   * - OAuth skills not connected: only connect_* tools from the connector skill
   * - Disabled skills (missing env): no tools
   */
  buildAllTools(ctx: SkillContext): Record<string, Tool> {
    const tools: Record<string, Tool> = {};
    const connected = ctx.connectedProviders ?? [];

    for (const skill of this.getEnabled()) {
      const skillTools = skill.buildTools(ctx);

      if (skill.requiresOAuth && !connected.includes(skill.requiresOAuth)) {
        // OAuth not connected: only expose connect_* tools so user can initiate connection
        for (const [name, t] of Object.entries(skillTools)) {
          if (name.startsWith("connect_")) {
            tools[name] = t;
          }
        }
        continue;
      }

      Object.assign(tools, skillTools);
    }

    return tools;
  }

  /** Get combined prompt instructions from available skills */
  getPromptInstructions(ctx: SkillContext): string[] {
    const connected = ctx.connectedProviders ?? [];
    const instructions: string[] = [];

    for (const skill of this.getEnabled()) {
      if (skill.requiresOAuth && !connected.includes(skill.requiresOAuth)) {
        // For unconnected OAuth skills, just mention they're available
        instructions.push(
          `- ${skill.name}: Disponible si el usuario conecta ${skill.requiresOAuth}. Usa connect_${skill.requiresOAuth} para generar el link.`,
        );
        continue;
      }

      const pi =
        typeof skill.promptInstructions === "function"
          ? skill.promptInstructions(ctx)
          : skill.promptInstructions;
      instructions.push(...pi);
    }

    return instructions;
  }

  /** Build tools only for specified skill names */
  buildFilteredTools(
    ctx: SkillContext,
    skillNames: Set<string>,
  ): Record<string, Tool> {
    const tools: Record<string, Tool> = {};
    const connected = ctx.connectedProviders ?? [];

    for (const skill of this.getEnabled()) {
      if (!skillNames.has(skill.name)) continue;

      if (skill.requiresOAuth && !connected.includes(skill.requiresOAuth)) {
        // Only expose connect_* tools for unconnected OAuth skills
        const skillTools = skill.buildTools(ctx);
        for (const [name, t] of Object.entries(skillTools)) {
          if (name.startsWith("connect_")) tools[name] = t;
        }
        continue;
      }

      const skillTools = skill.buildTools(ctx);
      Object.assign(tools, skillTools);
    }

    return tools;
  }

  /** Get prompt instructions only for specified skill names */
  getFilteredPromptInstructions(
    ctx: SkillContext,
    skillNames: Set<string>,
  ): string[] {
    const connected = ctx.connectedProviders ?? [];
    const instructions: string[] = [];

    for (const skill of this.getEnabled()) {
      if (!skillNames.has(skill.name)) continue;

      if (skill.requiresOAuth && !connected.includes(skill.requiresOAuth)) {
        instructions.push(
          `- ${skill.name}: Disponible si el usuario conecta ${skill.requiresOAuth}.`,
        );
        continue;
      }

      const pi =
        typeof skill.promptInstructions === "function"
          ? skill.promptInstructions(ctx)
          : skill.promptInstructions;
      instructions.push(...pi);
    }

    return instructions;
  }

  /** Get a summary of all skills and their status */
  getSummary(): Array<{
    name: string;
    description: string;
    category: string;
    enabled: boolean;
    missingEnv?: string[];
  }> {
    return this.getAll().map((skill) => {
      const missingEnv = skill.requiredEnv?.filter((key) => !process.env[key]);
      return {
        name: skill.name,
        description: skill.description,
        category: skill.category,
        enabled: !missingEnv || missingEnv.length === 0,
        missingEnv:
          missingEnv && missingEnv.length > 0 ? missingEnv : undefined,
      };
    });
  }
}

/** Singleton registry */
export const skillRegistry = new SkillRegistry();
