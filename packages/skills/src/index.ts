export { SkillRegistry, skillRegistry } from "./registry.js";
export type { SkillDefinition, SkillContext } from "./base-skill.js";

// Core skills
export { memorySkill } from "./memory/index.js";
export { notesSkill } from "./notes/index.js";
export { contactsSkill } from "./contacts/index.js";
export { remindersSkill } from "./reminders/index.js";

// Finance
export { financeSkill } from "./finance/index.js";

// Health
export { healthSkill } from "./health/index.js";
export { emergencySkill } from "./emergency/index.js";

// Communication
export { calendarSkill } from "./calendar/index.js";
export { gmailSkill } from "./gmail/index.js";

// Utility
export { weatherSkill } from "./weather/index.js";
export { newsSkill } from "./news/index.js";
export { translatorSkill } from "./translator/index.js";
export { exchangeSkill } from "./exchange/index.js";
export { dictationSkill } from "./dictation/index.js";
export { briefingSkill } from "./briefing/index.js";
export { voiceSkill } from "./voice/index.js";
export { visionSkill } from "./vision/index.js";
export { searchSkill } from "./search/index.js";
export { birthdaysSkill } from "./birthdays/index.js";
export { recipesSkill } from "./recipes/index.js";

// Register all skills
import { skillRegistry } from "./registry.js";
import { memorySkill } from "./memory/index.js";
import { notesSkill } from "./notes/index.js";
import { contactsSkill } from "./contacts/index.js";
import { remindersSkill } from "./reminders/index.js";
import { financeSkill } from "./finance/index.js";
import { healthSkill } from "./health/index.js";
import { emergencySkill } from "./emergency/index.js";
import { calendarSkill } from "./calendar/index.js";
import { gmailSkill } from "./gmail/index.js";
import { weatherSkill } from "./weather/index.js";
import { newsSkill } from "./news/index.js";
import { translatorSkill } from "./translator/index.js";
import { exchangeSkill } from "./exchange/index.js";
import { dictationSkill } from "./dictation/index.js";
import { briefingSkill } from "./briefing/index.js";
import { voiceSkill } from "./voice/index.js";
import { visionSkill } from "./vision/index.js";
import { searchSkill } from "./search/index.js";
import { birthdaysSkill } from "./birthdays/index.js";
import { recipesSkill } from "./recipes/index.js";

skillRegistry.register(memorySkill);
skillRegistry.register(notesSkill);
skillRegistry.register(contactsSkill);
skillRegistry.register(remindersSkill);
skillRegistry.register(financeSkill);
skillRegistry.register(healthSkill);
skillRegistry.register(emergencySkill);
skillRegistry.register(calendarSkill);
skillRegistry.register(gmailSkill);
skillRegistry.register(weatherSkill);
skillRegistry.register(newsSkill);
skillRegistry.register(translatorSkill);
skillRegistry.register(exchangeSkill);
skillRegistry.register(dictationSkill);
skillRegistry.register(briefingSkill);
skillRegistry.register(voiceSkill);
skillRegistry.register(visionSkill);
skillRegistry.register(searchSkill);
skillRegistry.register(birthdaysSkill);
skillRegistry.register(recipesSkill);
