import { Injectable, Logger } from "@nestjs/common";
import { Bot } from "grammy";
import { LIMITS } from "@evva/core";

@Injectable()
export class TelegramSenderService {
  private readonly logger = new Logger(TelegramSenderService.name);
  private bot: Bot;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token)
      throw new Error("TELEGRAM_BOT_TOKEN no configurado en el worker");
    this.bot = new Bot(token);
  }

  async send(telegramId: number, text: string): Promise<void> {
    if (!text?.trim()) return;

    try {
      if (text.length <= LIMITS.TELEGRAM_MAX_MESSAGE_LENGTH) {
        await this.bot.api.sendMessage(telegramId, text);
        return;
      }

      // Dividir mensajes largos
      const chunks = this.splitMessage(text);
      for (const chunk of chunks) {
        await this.bot.api.sendMessage(telegramId, chunk);
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (error) {
      this.logger.error(`Failed to send message to ${telegramId}: ${error}`);
      throw error;
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
}
