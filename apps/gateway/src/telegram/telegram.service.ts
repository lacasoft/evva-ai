import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Bot, type Context } from "grammy";
import { LIMITS } from "@evva/core";
import { transcribeAudio } from "@evva/ai";
import { UsersService } from "../users/users.service.js";
import { ConversationService } from "../conversation/conversation.service.js";
import { OnboardingService } from "../conversation/onboarding.service.js";

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot!: Bot;

  constructor(
    private readonly usersService: UsersService,
    private readonly conversationService: ConversationService,
    private readonly onboardingService: OnboardingService,
  ) {}

  async onModuleInit() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN no configurado");

    this.logger.log("Inicializando bot de Telegram...");
    this.bot = new Bot(token);
    this.registerHandlers();

    try {
      await this.startBot();
    } catch (error) {
      this.logger.error(`Error al iniciar bot de Telegram: ${error}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.bot.stop();
    this.logger.log("Bot detenido");
  }

  // ============================================================
  // Registro de handlers
  // ============================================================

  private registerHandlers() {
    // /start — bienvenida y onboarding
    this.bot.command("start", (ctx) => this.handleStart(ctx));

    // /reset — nueva sesión de conversación
    this.bot.command("reset", (ctx) => this.handleReset(ctx));

    // /memoria — ver facts guardados
    this.bot.command("memoria", (ctx) => this.handleMemory(ctx));

    // /ayuda — comandos disponibles
    this.bot.command("ayuda", (ctx) => this.handleHelp(ctx));

    // Mensajes de texto normales
    this.bot.on("message:text", (ctx) => this.handleMessage(ctx));

    // Notas de voz
    this.bot.on("message:voice", (ctx) => this.handleVoice(ctx));
    this.bot.on("message:audio", (ctx) => this.handleVoice(ctx));

    // Fotos
    this.bot.on("message:photo", (ctx) => this.handlePhoto(ctx));

    // Documentos (PDF, etc.)
    this.bot.on("message:document", (ctx) => this.handleDocument(ctx));

    // Ubicación
    this.bot.on("message:location", (ctx) => this.handleLocation(ctx));

    // Manejo de errores global
    this.bot.catch((err) => {
      this.logger.error(`Bot error: ${err.message ?? err}`, err.stack);
    });
  }

  // ============================================================
  // /start
  // ============================================================

  private async handleStart(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    try {
      const user = await this.usersService.findOrCreateUser({
        telegramId,
        telegramUsername: ctx.from?.username,
        telegramFirstName: ctx.from?.first_name,
      });

      const needsOnboarding = await this.onboardingService.needsOnboarding(
        user.id,
      );

      if (needsOnboarding) {
        const welcomeMessage =
          await this.onboardingService.startOnboarding(user);
        await this.sendMessage(telegramId, welcomeMessage);
      } else {
        const assistant = await this.usersService.getAssistant(user.id);
        await this.sendMessage(
          telegramId,
          `Hola de nuevo. Soy ${assistant?.name ?? "tu asistente"}, ¿en qué te ayudo?`,
        );
      }
    } catch (error) {
      this.logger.error(`Error handling /start: ${error}`);
      await this.sendMessage(telegramId, "Hubo un problema. Intenta de nuevo.");
    }
  }

  // ============================================================
  // Mensaje de texto — el flujo principal
  // ============================================================

  private async handleMessage(ctx: Context) {
    const telegramId = ctx.from?.id;
    const text = ctx.message?.text;

    if (!telegramId || !text) return;

    // Indicador de "escribiendo..."
    await ctx.replyWithChatAction("typing");

    try {
      const user = await this.usersService.findOrCreateUser({
        telegramId,
        telegramUsername: ctx.from?.username,
        telegramFirstName: ctx.from?.first_name,
      });

      // Verificar si está en onboarding
      const needsOnboarding = await this.onboardingService.needsOnboarding(
        user.id,
      );

      if (needsOnboarding) {
        const response = await this.onboardingService.handleOnboardingMessage(
          user,
          text,
        );

        await this.sendMessage(telegramId, response.message);
        return;
      }

      // Conversación normal
      const assistant = await this.usersService.getAssistant(user.id);
      if (!assistant) {
        // Estado inconsistente — reiniciar onboarding
        const welcomeMessage =
          await this.onboardingService.startOnboarding(user);
        await this.sendMessage(telegramId, welcomeMessage);
        return;
      }

      const result = await this.conversationService.processMessage({
        user,
        assistant,
        incomingText: text,
        telegramMessageId: ctx.message?.message_id,
      });

      await this.sendMessage(telegramId, result.reply);
    } catch (error) {
      this.logger.error(`Error handling message from ${telegramId}: ${error}`);
      await this.sendMessage(
        telegramId,
        "Tuve un problema procesando tu mensaje. Intenta de nuevo.",
      );
    }
  }

  // ============================================================
  // Foto — procesa con Claude Vision
  // ============================================================

  private async handlePhoto(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    await ctx.replyWithChatAction("typing");

    try {
      const user = await this.usersService.findOrCreateUser({
        telegramId,
        telegramUsername: ctx.from?.username,
        telegramFirstName: ctx.from?.first_name,
      });

      // Obtener la foto de mayor resolución (última del array)
      const photos = ctx.message?.photo;
      if (!photos || photos.length === 0) return;

      const photo = photos[photos.length - 1];
      const file = await ctx.api.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${this.bot.token}/${file.file_path}`;

      // Descargar la imagen como buffer (Claude no puede acceder a URLs de Telegram)
      const imgResponse = await fetch(fileUrl);
      if (!imgResponse.ok) {
        throw new Error(`Failed to download photo: ${imgResponse.status}`);
      }
      const imageData = Buffer.from(await imgResponse.arrayBuffer());

      const caption = ctx.message?.caption ?? "";

      this.logger.log(
        `Photo received from user ${user.id} (${photo.width}x${photo.height}, ${imageData.length} bytes)`,
      );

      // Verificar onboarding
      const needsOnboarding = await this.onboardingService.needsOnboarding(
        user.id,
      );
      if (needsOnboarding) {
        await this.sendMessage(
          telegramId,
          "Primero necesito que me des un nombre. ¿Cómo quieres llamarme?",
        );
        return;
      }

      const assistant = await this.usersService.getAssistant(user.id);
      if (!assistant) {
        const welcomeMessage =
          await this.onboardingService.startOnboarding(user);
        await this.sendMessage(telegramId, welcomeMessage);
        return;
      }

      const result = await this.conversationService.processMessage({
        user,
        assistant,
        incomingText: caption || "¿Qué ves en esta imagen?",
        imageData,
        telegramMessageId: ctx.message?.message_id,
      });

      await this.sendMessage(telegramId, result.reply);
    } catch (error) {
      this.logger.error(`Error handling photo from ${telegramId}: ${error}`);
      await this.sendMessage(
        telegramId,
        "No pude procesar la imagen. Intenta de nuevo.",
      );
    }
  }

  // ============================================================
  // Documento — procesa PDF y otros archivos con Claude
  // ============================================================

  private async handleDocument(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    await ctx.replyWithChatAction("typing");

    try {
      const doc = ctx.message?.document;
      if (!doc) return;

      const user = await this.usersService.findOrCreateUser({
        telegramId,
        telegramUsername: ctx.from?.username,
        telegramFirstName: ctx.from?.first_name,
      });

      const needsOnboarding = await this.onboardingService.needsOnboarding(
        user.id,
      );
      if (needsOnboarding) {
        await this.sendMessage(
          telegramId,
          "Primero necesito que me des un nombre. ¿Cómo quieres llamarme?",
        );
        return;
      }

      const file = await ctx.api.getFile(doc.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${this.bot.token}/${file.file_path}`;

      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download document: ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const fileName = doc.file_name ?? "document";
      const mimeType = doc.mime_type ?? "";

      this.logger.log(
        `Document received from user ${user.id}: ${fileName} (${mimeType}, ${buffer.length} bytes)`,
      );

      const assistant = await this.usersService.getAssistant(user.id);
      if (!assistant) {
        await this.sendMessage(
          telegramId,
          "Primero configura tu asistente con /start",
        );
        return;
      }

      // Para PDFs e imágenes, enviar como imagen a Claude Vision
      if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
        const result = await this.conversationService.processMessage({
          user,
          assistant,
          incomingText:
            ctx.message?.caption || `Analiza este documento: ${fileName}`,
          imageData: buffer,
          telegramMessageId: ctx.message?.message_id,
        });
        await this.sendMessage(telegramId, result.reply);
      } else {
        // Para otros archivos de texto, leer como string
        const textContent = buffer.toString("utf-8").slice(0, 4000);
        const result = await this.conversationService.processMessage({
          user,
          assistant,
          incomingText: `El usuario envió un archivo "${fileName}". Contenido:\n\n${textContent}`,
          telegramMessageId: ctx.message?.message_id,
        });
        await this.sendMessage(telegramId, result.reply);
      }
    } catch (error) {
      this.logger.error(`Error handling document from ${telegramId}: ${error}`);
      await this.sendMessage(
        telegramId,
        "No pude procesar el documento. Intenta de nuevo.",
      );
    }
  }

  // ============================================================
  // Ubicación — guardar o compartir con contacto de emergencia
  // ============================================================

  private async handleLocation(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    await ctx.replyWithChatAction("typing");

    try {
      const location = ctx.message?.location;
      if (!location) return;

      const user = await this.usersService.findOrCreateUser({
        telegramId,
        telegramUsername: ctx.from?.username,
        telegramFirstName: ctx.from?.first_name,
      });

      const assistant = await this.usersService.getAssistant(user.id);
      if (!assistant) {
        await this.sendMessage(
          telegramId,
          "Primero configura tu asistente con /start",
        );
        return;
      }

      this.logger.log(
        `Location received from user ${user.id}: ${location.latitude}, ${location.longitude}`,
      );

      const result = await this.conversationService.processMessage({
        user,
        assistant,
        incomingText: `El usuario compartió su ubicación: latitud ${location.latitude}, longitud ${location.longitude}. Pregúntale si quiere que la guarde, la comparta con alguien, o si necesita ayuda con algo cercano.`,
        telegramMessageId: ctx.message?.message_id,
      });

      await this.sendMessage(telegramId, result.reply);
    } catch (error) {
      this.logger.error(`Error handling location from ${telegramId}: ${error}`);
    }
  }

  // ============================================================
  // Nota de voz — transcribe y procesa como texto
  // ============================================================

  private async handleVoice(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    await ctx.replyWithChatAction("typing");

    try {
      const user = await this.usersService.findOrCreateUser({
        telegramId,
        telegramUsername: ctx.from?.username,
        telegramFirstName: ctx.from?.first_name,
      });

      // Obtener el archivo de audio de Telegram
      const voice = ctx.message?.voice ?? ctx.message?.audio;
      if (!voice) return;

      const file = await ctx.api.getFile(voice.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${this.bot.token}/${file.file_path}`;

      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download voice file: ${response.status}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());

      // Transcribir con Whisper
      const { text: transcribedText, durationSeconds } = await transcribeAudio(
        audioBuffer,
        file.file_path ?? "voice.ogg",
        user.language,
      );

      if (!transcribedText.trim()) {
        await this.sendMessage(
          telegramId,
          "No pude entender el audio. ¿Podrías repetirlo?",
        );
        return;
      }

      this.logger.log(
        `Voice transcribed for user ${user.id}: "${transcribedText.slice(0, 80)}..." (${durationSeconds ?? "?"}s)`,
      );

      // Verificar onboarding
      const needsOnboarding = await this.onboardingService.needsOnboarding(
        user.id,
      );
      if (needsOnboarding) {
        const onboardingResponse =
          await this.onboardingService.handleOnboardingMessage(
            user,
            transcribedText,
          );
        await this.sendMessage(telegramId, onboardingResponse.message);
        return;
      }

      // Procesar como mensaje normal
      const assistant = await this.usersService.getAssistant(user.id);
      if (!assistant) {
        const welcomeMessage =
          await this.onboardingService.startOnboarding(user);
        await this.sendMessage(telegramId, welcomeMessage);
        return;
      }

      const result = await this.conversationService.processMessage({
        user,
        assistant,
        incomingText: transcribedText,
        telegramMessageId: ctx.message?.message_id,
      });

      await this.sendMessage(telegramId, result.reply);
    } catch (error) {
      this.logger.error(`Error handling voice from ${telegramId}: ${error}`);

      const errorMessage = String(error).includes("GROQ_API_KEY")
        ? "La transcripción de voz no está configurada todavía."
        : "No pude procesar tu nota de voz. Intenta de nuevo o escríbeme en texto.";

      await this.sendMessage(telegramId, errorMessage);
    }
  }

  // ============================================================
  // /reset — nueva sesión
  // ============================================================

  private async handleReset(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    try {
      const user = await this.usersService.getUserByTelegramId(telegramId);
      if (user) {
        this.conversationService.resetSession(user.id);
      }
      await this.sendMessage(
        telegramId,
        "Listo, empezamos de cero. ¿En qué te ayudo?",
      );
    } catch (error) {
      this.logger.error(`Error handling /reset: ${error}`);
    }
  }

  // ============================================================
  // /memoria — ver facts del usuario
  // ============================================================

  private async handleMemory(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    try {
      const user = await this.usersService.getUserByTelegramId(telegramId);
      if (!user) {
        await this.sendMessage(
          telegramId,
          "Primero usa /start para configurar tu asistente.",
        );
        return;
      }

      const assistant = await this.usersService.getAssistant(user.id);
      const result = await this.conversationService.processMessage({
        user,
        assistant: assistant!,
        incomingText:
          "Muéstrame un resumen de lo que recuerdas sobre mí. Sé conciso.",
      });

      await this.sendMessage(telegramId, result.reply);
    } catch (error) {
      this.logger.error(`Error handling /memoria: ${error}`);
    }
  }

  // ============================================================
  // /ayuda
  // ============================================================

  private async handleHelp(ctx: Context) {
    const help = `Esto es lo que puedo hacer por ti:

📝 *Notas y listas*
"Anota que tengo junta el lunes"
"Haz una lista del super: leche, huevos, pan"
"¿Qué tengo pendiente?"
"Agrega tortillas a la lista del super"

⏰ *Recordatorios*
"Recuérdame en 30 minutos sacar la ropa"
"Avísame mañana a las 9am de la junta"

👤 *Contactos*
"Guarda el teléfono de mi dentista: Dr. López, 5512345678"
"¿Cuál es el número de mi dentista?"

🧠 *Memoria*
Recuerdo lo que me cuentas: nombres de tu familia, preferencias, fechas importantes. Solo dímelo y lo guardo.

🔍 *Búsqueda y clima*
"¿Cómo está el clima en Monterrey?"
"Busca el tipo de cambio del dólar"

📷 *Fotos*
Envíame fotos y las analizo: recibos, documentos, menús, lo que sea.

🎤 *Notas de voz*
Puedes enviarme audios y los proceso como texto.

*Comandos:*
/start — Presentarme
/reset — Nueva conversación
/memoria — Lo que recuerdo de ti
/ayuda — Esta lista`;

    await this.sendMessage(ctx.from!.id, help);
  }

  // ============================================================
  // Enviar mensaje — con manejo de longitud máxima de Telegram
  // ============================================================

  async sendMessage(telegramId: number, text: string): Promise<void> {
    if (!text?.trim()) return;

    try {
      // Si el mensaje es muy largo, lo dividimos
      if (text.length <= LIMITS.TELEGRAM_MAX_MESSAGE_LENGTH) {
        await this.bot.api.sendMessage(telegramId, text);
        return;
      }

      // Dividir en chunks respetando párrafos
      const chunks = this.splitMessage(text);
      for (const chunk of chunks) {
        await this.bot.api.sendMessage(telegramId, chunk);
        // Pequeña pausa entre mensajes para evitar rate limiting
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } catch (error) {
      this.logger.error(`Failed to send message to ${telegramId}: ${error}`);
    }
  }

  private splitMessage(text: string): string[] {
    const maxLen = LIMITS.TELEGRAM_MAX_MESSAGE_LENGTH - 100;
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

  // ============================================================
  // Arranque del bot — webhook o polling según el ambiente
  // ============================================================

  private async startBot() {
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;

    if (webhookUrl && process.env.NODE_ENV === "production") {
      // Producción: webhook para Fly.io
      const secretToken = process.env.TELEGRAM_SECRET_TOKEN;

      await this.bot.api.setWebhook(`${webhookUrl}/api/telegram/webhook`, {
        secret_token: secretToken,
        allowed_updates: ["message", "callback_query"],
      });

      this.logger.log(`Bot iniciado con webhook: ${webhookUrl}`);
    } else {
      // Desarrollo: long polling
      this.bot
        .start({
          onStart: (info) => {
            this.logger.log(`Bot iniciado con polling: @${info.username}`);
          },
        })
        .catch((err) => {
          this.logger.error(`Bot polling error: ${err.message ?? err}`);
          this.logger.error(
            "Verifica que TELEGRAM_BOT_TOKEN sea válido. El gateway sigue corriendo pero el bot no responderá.",
          );
        });

      this.logger.log("Bot iniciado con long polling (modo desarrollo)");
    }
  }

  // Expuesto para el controller del webhook
  getBotInstance(): Bot {
    return this.bot;
  }
}
