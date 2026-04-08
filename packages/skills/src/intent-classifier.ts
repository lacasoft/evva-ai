import type { SkillDefinition } from "./base-skill.js";

// Core skills always loaded regardless of intent
const CORE_SKILLS = new Set([
  "memory",
  "notes",
  "contacts",
  "reminders",
  "data-management",
  "birthdays",
  "health",
  "finance",
]);

/**
 * Classifies user message intent and returns relevant skill names.
 * Pure keyword matching — no LLM calls, microsecond latency.
 */
export function classifyIntent(
  message: string,
  skills: SkillDefinition[],
): Set<string> {
  const result = new Set<string>();
  const lower = message.toLowerCase();

  // Always include core skills
  for (const name of CORE_SKILLS) {
    result.add(name);
  }

  // Match specialized skills by keywords
  for (const skill of skills) {
    if (!skill.keywords || skill.keywords.length === 0) continue;
    if (CORE_SKILLS.has(skill.name)) continue; // already included

    for (const keyword of skill.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        result.add(skill.name);
        break;
      }
    }
  }

  // Fallback: if only core matched and message is substantial, load all
  if (result.size <= CORE_SKILLS.size && lower.length > 20) {
    // Check if any specialized keyword even partially matches
    let hasSpecializedMatch = false;
    for (const skill of skills) {
      if (CORE_SKILLS.has(skill.name)) continue;
      if (result.has(skill.name)) {
        hasSpecializedMatch = true;
        break;
      }
    }
    if (!hasSpecializedMatch) {
      // Load all as fallback
      for (const skill of skills) {
        result.add(skill.name);
      }
    }
  }

  return result;
}

export { CORE_SKILLS };
