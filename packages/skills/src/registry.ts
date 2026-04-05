import type { Tool } from "ai";
import type { AgeRange } from "@evva/core";
import type { SkillContext, SkillDefinition } from "./base-skill.js";

export class SkillRegistry {
  private skills = new Map<string, SkillDefinition>();

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

  /** Get skills by category */
  getByCategory(category: SkillDefinition["category"]): SkillDefinition[] {
    return this.getAll().filter((s) => s.category === category);
  }

  /** Check which skills are currently enabled (all required env vars present) */
  getEnabled(): SkillDefinition[] {
    return this.getAll().filter((skill) => {
      if (skill.requiredEnv) {
        return skill.requiredEnv.every((key) => !!process.env[key]);
      }
      return true;
    });
  }

  /** Build all tools from enabled skills for a given user context */
  buildAllTools(ctx: SkillContext): Record<string, Tool> {
    const tools: Record<string, Tool> = {};

    for (const skill of this.getEnabled()) {
      const skillTools = skill.buildTools(ctx);
      Object.assign(tools, skillTools);
    }

    return tools;
  }

  /** Get combined prompt instructions from all enabled skills */
  getPromptInstructions(): string[] {
    return this.getEnabled().flatMap((s) => s.promptInstructions);
  }

  /** Get a summary of all skills for display */
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
