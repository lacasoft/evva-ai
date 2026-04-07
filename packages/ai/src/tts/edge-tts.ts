// ============================================================
// Text-to-Speech using OpenAI TTS API
// Supports Spanish and English with natural voices
// Requires OPENAI_API_KEY in .env
// Falls back gracefully if not configured
// ============================================================

export interface TTSResult {
  audio: Buffer;
}

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";

/**
 * Convert text to speech audio buffer using OpenAI TTS.
 * Model: tts-1 (fast) or tts-1-hd (quality)
 * Voices: alloy, echo, fable, onyx, nova, shimmer
 */
export async function textToSpeech(params: {
  text: string;
  language?: "es" | "en";
  gender?: "male" | "female";
}): Promise<TTSResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY for TTS. Add it to .env to enable voice responses.",
    );
  }

  // Voice selection based on gender preference
  // nova/shimmer = female-sounding, onyx/echo = male-sounding
  const voice = params.gender === "male" ? "onyx" : "nova";

  const response = await fetch(OPENAI_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: params.text,
      voice,
      response_format: "opus",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI TTS failed: ${response.status} ${error}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return { audio: buffer };
}
