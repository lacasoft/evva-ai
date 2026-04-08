import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";

/**
 * TTS skill — text-to-speech responses.
 * The actual audio generation happens in the transport layer (Telegram/WhatsApp).
 * This skill provides the tool for the LLM to trigger voice responses
 * and metadata for the registry.
 */
export const ttsSkill: SkillDefinition = {
  name: "tts",
  description: "Respuestas por nota de voz usando Text-to-Speech",
  category: "utility",
  forProfiles: ["young", "adult", "senior"],

  buildTools: () => ({
    respond_with_voice: tool({
      description:
        "Responde al usuario con una nota de voz en vez de texto. " +
        "Usalo cuando el usuario pida que le hables, le respondas con audio, " +
        "o diga 'hablame', 'dime con voz', 'mandame un audio', 'responde por voz'. " +
        "Tambien usalo proactivamente con adultos mayores que prefieran audio.",
      parameters: z.object({
        text: z
          .string()
          .describe(
            "El texto que se convertira a voz. Escribe de forma natural, como si hablaras.",
          ),
        language: z
          .string()
          .default("es")
          .describe("Codigo de idioma: es, en, fr, pt, etc."),
      }),
      execute: async ({ text, language }) => {
        // The actual TTS conversion happens in the transport layer
        // This tool returns a special marker that the transport picks up
        return {
          success: true,
          type: "voice_response",
          text,
          language,
          message: "Respuesta de voz generada.",
        };
      },
    }),
  }),

  promptInstructions: [
    "- respond_with_voice: Responde con nota de voz. Usalo cuando el usuario pida audio, diga 'hablame', 'mandame un audio', o con adultos mayores que prefieran voz.",
    "  Cuando uses esta tool, escribe tu respuesta de forma conversacional y natural, como si hablaras en voz alta. Incluye [VOICE] al inicio de tu respuesta de texto para activar el audio.",
  ],
};
