import type { SkillDefinition } from "../base-skill.js";

/**
 * Vision skill — photo processing is handled at the Telegram handler level
 * (not as an LLM tool), so this skill only provides metadata and prompt instructions.
 */
export const visionSkill: SkillDefinition = {
  name: "vision",
  description: "Analisis de fotos y documentos con Claude Vision",
  category: "utility",
  forProfiles: ["young", "adult", "senior"],
  keywords: ["foto", "imagen", "documento", "que ves"],

  // Photo/document processing happens in TelegramService.handlePhoto/handleDocument
  buildTools: () => ({}),

  promptInstructions: [
    "- El usuario puede enviar fotos y documentos. Se analizan automaticamente con vision.",
    "- Cuando recibas una imagen, describe lo que ves y sugiere acciones relevantes.",
  ],
};
