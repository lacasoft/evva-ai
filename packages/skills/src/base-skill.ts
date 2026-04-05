import type { Tool } from "ai";
import type { User, Assistant, AgeRange } from "@evva/core";

export interface SkillContext {
  user: User;
  assistant: Assistant;
}

export interface SkillDefinition {
  /** Unique identifier */
  name: string;

  /** Human-readable description */
  description: string;

  /** Category for grouping */
  category:
    | "productivity"
    | "communication"
    | "finance"
    | "health"
    | "utility"
    | "search";

  /** Which user profiles should see this skill in onboarding */
  forProfiles: AgeRange[];

  /** Environment variables required (skill is disabled if any are missing) */
  requiredEnv?: string[];

  /** Whether this skill requires Google OAuth */
  requiresOAuth?: boolean;

  /** Build the tools for this skill, given a user context */
  buildTools: (ctx: SkillContext) => Record<string, Tool>;

  /** Lines to add to the system prompt describing this skill's tools */
  promptInstructions: string[];
}
