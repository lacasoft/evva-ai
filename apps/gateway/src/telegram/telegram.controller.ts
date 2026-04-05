import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  HttpCode,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { webhookCallback } from 'grammy';
import { TelegramService } from './telegram.service.js';

@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-telegram-bot-api-secret-token') secretToken: string,
  ): Promise<void> {
    // Verificar el secret token para autenticar que viene de Telegram
    const expectedToken = process.env.TELEGRAM_SECRET_TOKEN;
    if (expectedToken && secretToken !== expectedToken) {
      this.logger.warn('Webhook request with invalid secret token');
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    try {
      const bot = this.telegramService.getBotInstance();
      const handler = webhookCallback(bot, 'express');
      await handler(req, res);
    } catch (error) {
      this.logger.error(`Webhook handler error: ${error}`);
      if (!res.headersSent) {
        res.status(200).json({ ok: true }); // Siempre 200 a Telegram
      }
    }
  }
}
