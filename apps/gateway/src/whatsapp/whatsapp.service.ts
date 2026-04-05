import { Injectable, Logger } from "@nestjs/common";
import { transcribeAudio } from "@evva/ai";
import { UsersService } from "../users/users.service.js";
import { ConversationService } from "../conversation/conversation.service.js";
import { OnboardingService } from "../conversation/onboarding.service.js";
import type { WhatsAppIncomingMessage } from "./whatsapp.controller.js";
import type { User } from "@evva/core";

// ============================================================
// WhatsApp Cloud API constants
// ============================================================

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";
const MAX_WHATSAPP_MESSAGE_LENGTH = 4096;

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly conversationService: ConversationService,
    private readonly onboardingService: OnboardingService,
  ) {}

  // ============================================================
  // Message router — dispatches by message type
  // ============================================================

  async handleMessage(
    from: string,
    message: WhatsAppIncomingMessage,
  ): Promise<void> {
    this.logger.log(`WhatsApp message from ${from}: type=${message.type}`);

    try {
      switch (message.type) {
        case "text":
          await this.handleTextMessage(from, message.text?.body ?? "");
          break;

        case "audio":
          await this.handleAudioMessage(from, message);
          break;

        case "image":
          await this.handleImageMessage(from, message);
          break;

        case "location":
          await this.handleLocationMessage(from, message);
          break;

        case "document":
          await this.handleDocumentMessage(from, message);
          break;

        default:
          await this.sendMessage(
            from,
            "Por ahora solo puedo procesar texto, audio, fotos, documentos y ubicaciones.",
          );
      }
    } catch (error) {
      this.logger.error(
        `Error handling WhatsApp message from ${from}: ${error}`,
      );
      await this.sendMessage(
        from,
        "Tuve un problema procesando tu mensaje. Intenta de nuevo.",
      );
    }
  }

  // ============================================================
  // Text messages
  // ============================================================

  private async handleTextMessage(from: string, text: string): Promise<void> {
    if (!text.trim()) return;

    const user = await this.resolveUser(from);

    // Check for commands
    if (
      text.trim().toLowerCase() === "/start" ||
      text.trim().toLowerCase() === "hola"
    ) {
      await this.handleStart(from, user);
      return;
    }

    if (text.trim().toLowerCase() === "/reset") {
      this.conversationService.resetSession(user.id);
      await this.sendMessage(
        from,
        "Listo, empezamos de cero. \u00bfEn qu\u00e9 te ayudo?",
      );
      return;
    }

    // Check onboarding
    const needsOnboarding = await this.onboardingService.needsOnboarding(
      user.id,
    );
    if (needsOnboarding) {
      const response = await this.onboardingService.handleOnboardingMessage(
        user,
        text,
      );
      await this.sendMessage(from, response.message);
      return;
    }

    // Normal conversation
    const assistant = await this.usersService.getAssistant(user.id);
    if (!assistant) {
      const welcomeMessage = await this.onboardingService.startOnboarding(user);
      await this.sendMessage(from, welcomeMessage);
      return;
    }

    const result = await this.conversationService.processMessage({
      user,
      assistant,
      incomingText: text,
    });

    await this.sendMessage(from, result.reply);
  }

  // ============================================================
  // Audio messages — download and transcribe with Whisper
  // ============================================================

  private async handleAudioMessage(
    from: string,
    message: WhatsAppIncomingMessage,
  ): Promise<void> {
    const audioId = message.audio?.id;
    if (!audioId) return;

    const user = await this.resolveUser(from);
    const audioBuffer = await this.downloadMedia(audioId);

    const { text: transcribedText } = await transcribeAudio(
      audioBuffer,
      "voice.ogg",
      user.language,
    );

    if (!transcribedText.trim()) {
      await this.sendMessage(
        from,
        "No pude entender el audio. \u00bfPodr\u00edas repetirlo?",
      );
      return;
    }

    this.logger.log(
      `WhatsApp voice transcribed for ${from}: "${transcribedText.slice(0, 80)}..."`,
    );

    // Check onboarding
    const needsOnboarding = await this.onboardingService.needsOnboarding(
      user.id,
    );
    if (needsOnboarding) {
      const response = await this.onboardingService.handleOnboardingMessage(
        user,
        transcribedText,
      );
      await this.sendMessage(from, response.message);
      return;
    }

    const assistant = await this.usersService.getAssistant(user.id);
    if (!assistant) {
      const welcomeMessage = await this.onboardingService.startOnboarding(user);
      await this.sendMessage(from, welcomeMessage);
      return;
    }

    const result = await this.conversationService.processMessage({
      user,
      assistant,
      incomingText: transcribedText,
    });

    await this.sendMessage(from, result.reply);
  }

  // ============================================================
  // Image messages — download and process with Vision
  // ============================================================

  private async handleImageMessage(
    from: string,
    message: WhatsAppIncomingMessage,
  ): Promise<void> {
    const imageId = message.image?.id;
    if (!imageId) return;

    const user = await this.resolveUser(from);

    const needsOnboarding = await this.onboardingService.needsOnboarding(
      user.id,
    );
    if (needsOnboarding) {
      await this.sendMessage(
        from,
        "Primero necesito que me des un nombre. \u00bfC\u00f3mo quieres llamarme?",
      );
      return;
    }

    const assistant = await this.usersService.getAssistant(user.id);
    if (!assistant) {
      const welcomeMessage = await this.onboardingService.startOnboarding(user);
      await this.sendMessage(from, welcomeMessage);
      return;
    }

    const imageData = await this.downloadMedia(imageId);
    const caption = message.image?.caption ?? "";

    this.logger.log(
      `WhatsApp image received from ${from} (${imageData.length} bytes)`,
    );

    const result = await this.conversationService.processMessage({
      user,
      assistant,
      incomingText: caption || "\u00bfQu\u00e9 ves en esta imagen?",
      imageData,
    });

    await this.sendMessage(from, result.reply);
  }

  // ============================================================
  // Document messages — PDF, text files, etc.
  // ============================================================

  private async handleDocumentMessage(
    from: string,
    message: WhatsAppIncomingMessage,
  ): Promise<void> {
    const docId = message.document?.id;
    if (!docId) return;

    const user = await this.resolveUser(from);

    const needsOnboarding = await this.onboardingService.needsOnboarding(
      user.id,
    );
    if (needsOnboarding) {
      await this.sendMessage(
        from,
        "Primero necesito que me des un nombre. \u00bfC\u00f3mo quieres llamarme?",
      );
      return;
    }

    const assistant = await this.usersService.getAssistant(user.id);
    if (!assistant) {
      await this.sendMessage(
        from,
        "Primero configura tu asistente enviando 'hola'",
      );
      return;
    }

    const buffer = await this.downloadMedia(docId);
    const fileName = message.document?.filename ?? "document";
    const mimeType = message.document?.mime_type ?? "";

    this.logger.log(
      `WhatsApp document from ${from}: ${fileName} (${mimeType}, ${buffer.length} bytes)`,
    );

    if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
      const result = await this.conversationService.processMessage({
        user,
        assistant,
        incomingText:
          message.document?.caption || `Analiza este documento: ${fileName}`,
        imageData: buffer,
      });
      await this.sendMessage(from, result.reply);
    } else {
      const textContent = buffer.toString("utf-8").slice(0, 4000);
      const result = await this.conversationService.processMessage({
        user,
        assistant,
        incomingText: `El usuario envi\u00f3 un archivo "${fileName}". Contenido:\n\n${textContent}`,
      });
      await this.sendMessage(from, result.reply);
    }
  }

  // ============================================================
  // Location messages
  // ============================================================

  private async handleLocationMessage(
    from: string,
    message: WhatsAppIncomingMessage,
  ): Promise<void> {
    const location = message.location;
    if (!location) return;

    const user = await this.resolveUser(from);

    const assistant = await this.usersService.getAssistant(user.id);
    if (!assistant) {
      await this.sendMessage(
        from,
        "Primero configura tu asistente enviando 'hola'",
      );
      return;
    }

    this.logger.log(
      `WhatsApp location from ${from}: ${location.latitude}, ${location.longitude}`,
    );

    const result = await this.conversationService.processMessage({
      user,
      assistant,
      incomingText: `El usuario comparti\u00f3 su ubicaci\u00f3n: latitud ${location.latitude}, longitud ${location.longitude}. Preg\u00fantale si quiere que la guarde, la comparta con alguien, o si necesita ayuda con algo cercano.`,
    });

    await this.sendMessage(from, result.reply);
  }

  // ============================================================
  // /start equivalent
  // ============================================================

  private async handleStart(from: string, user: User): Promise<void> {
    const needsOnboarding = await this.onboardingService.needsOnboarding(
      user.id,
    );

    if (needsOnboarding) {
      const welcomeMessage = await this.onboardingService.startOnboarding(user);
      await this.sendMessage(from, welcomeMessage);
    } else {
      const assistant = await this.usersService.getAssistant(user.id);
      await this.sendMessage(
        from,
        `Hola de nuevo. Soy ${assistant?.name ?? "tu asistente"}, \u00bfen qu\u00e9 te ayudo?`,
      );
    }
  }

  // ============================================================
  // Send message via WhatsApp Cloud API
  // ============================================================

  async sendMessage(to: string, text: string): Promise<void> {
    if (!text?.trim()) return;

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      this.logger.error(
        "WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not configured",
      );
      return;
    }

    try {
      // Split long messages
      const chunks = this.splitMessage(text);

      for (const chunk of chunks) {
        const response = await fetch(
          `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to,
              type: "text",
              text: { body: chunk },
            }),
          },
        );

        if (!response.ok) {
          const errorBody = await response.text();
          this.logger.error(
            `WhatsApp API error (${response.status}): ${errorBody}`,
          );
        }

        // Small delay between chunks to avoid rate limiting
        if (chunks.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp message to ${to}: ${error}`);
    }
  }

  // ============================================================
  // Download media from WhatsApp Cloud API
  // ============================================================

  private async downloadMedia(mediaId: string): Promise<Buffer> {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    // Step 1: Get the media URL
    const metaResponse = await fetch(`${GRAPH_API_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!metaResponse.ok) {
      throw new Error(`Failed to get media URL: ${metaResponse.status}`);
    }

    const meta = (await metaResponse.json()) as { url: string };

    // Step 2: Download the actual file
    const fileResponse = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!fileResponse.ok) {
      throw new Error(`Failed to download media: ${fileResponse.status}`);
    }

    return Buffer.from(await fileResponse.arrayBuffer());
  }

  // ============================================================
  // Resolve WhatsApp phone number to internal user
  // Uses phone number as telegramId (numeric representation)
  // ============================================================

  private async resolveUser(phoneNumber: string): Promise<User> {
    // WhatsApp phone numbers are numeric strings (e.g. "5215512345678")
    // We store them in the telegramId field as a number
    const numericId = Number(phoneNumber);

    return this.usersService.findOrCreateUser({
      telegramId: numericId,
      telegramFirstName: phoneNumber,
    });
  }

  // ============================================================
  // Split long messages respecting WhatsApp limits
  // ============================================================

  private splitMessage(text: string): string[] {
    const maxLen = MAX_WHATSAPP_MESSAGE_LENGTH - 100;

    if (text.length <= MAX_WHATSAPP_MESSAGE_LENGTH) {
      return [text];
    }

    const chunks: string[] = [];
    const paragraphs = text.split("\n\n");
    let current = "";

    for (const para of paragraphs) {
      if ((current + "\n\n" + para).length > maxLen) {
        if (current) chunks.push(current.trim());
        current = para;
      } else {
        current = current ? current + "\n\n" + para : para;
      }
    }

    if (current) chunks.push(current.trim());
    return chunks;
  }
}
