// ============================================================
// Transcripción de audio — Whisper via Groq (gratis y rápido)
// Groq ofrece whisper-large-v3-turbo con tier gratuito
// Docs: https://console.groq.com/docs/speech-text
// ============================================================

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const WHISPER_MODEL = 'whisper-large-v3-turbo';

export interface TranscriptionResult {
  text: string;
  language?: string;
  durationSeconds?: number;
}

/**
 * Transcribe un buffer de audio usando Whisper via Groq.
 * Soporta formatos: ogg, mp3, wav, m4a, webm
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename = 'audio.ogg',
  language = 'es',
): Promise<TranscriptionResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY environment variable. Get one free at https://console.groq.com');
  }

  const formData = new FormData();
  // Normalizar extensión — Telegram envía .oga que Groq no reconoce
  const normalizedFilename = filename.replace(/\.oga$/, '.ogg');
  const blob = new Blob([audioBuffer], { type: 'audio/ogg' });
  formData.append('file', blob, normalizedFilename);
  formData.append('model', WHISPER_MODEL);
  formData.append('language', language);
  formData.append('response_format', 'verbose_json');

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Whisper transcription failed: ${response.status} ${error}`);
  }

  const data = (await response.json()) as {
    text: string;
    language?: string;
    duration?: number;
  };

  return {
    text: data.text.trim(),
    language: data.language,
    durationSeconds: data.duration,
  };
}
