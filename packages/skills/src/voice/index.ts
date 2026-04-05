import type { SkillDefinition } from "../base-skill.js";

/**
 * Voice skill — transcription is handled at the Telegram handler level
 * (not as an LLM tool), so this skill only provides metadata and prompt instructions.
 */
export const voiceSkill: SkillDefinition = {
  name: "voice",
  description: "Transcripcion de notas de voz usando Whisper via Groq",
  category: "utility",
  forProfiles: ["young", "adult", "senior"],
  requiredEnv: ["GROQ_API_KEY"],

  // Voice processing happens in TelegramService.handleVoice, not as an LLM tool
  buildTools: () => ({}),

  promptInstructions: [
    "- El usuario puede enviar notas de voz. Se transcriben automaticamente y se procesan como texto.",
  ],
};
