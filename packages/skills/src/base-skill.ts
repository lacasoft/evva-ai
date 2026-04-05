import type { Tool } from "ai";
import type { User, Assistant, AgeRange } from "@evva/core";

export interface SkillContext {
  user: User;
  assistant: Assistant;
  /** OAuth providers the user has connected (checked at request time) */
  connectedProviders?: string[];
  /** Gateway services exposed to skills */
  services?: {
    scheduleReminder?: (params: {
      userId: string;
      telegramId: number;
      message: string;
      assistantName: string;
      triggerAt: Date;
      additionalContext?: string;
    }) => Promise<string>;
  };
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

  /** OAuth provider required (e.g., 'google', 'spotify') */
  requiresOAuth?: string;

  /** Build the tools for this skill, given a user context */
  buildTools: (ctx: SkillContext) => Record<string, Tool>;

  /** Lines to add to the system prompt describing this skill's tools */
  promptInstructions: string[] | ((ctx: SkillContext) => string[]);
}
