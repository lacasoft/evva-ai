import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { exchangeGoogleCode } from '@evva/ai';
import { upsertOAuthToken } from '@evva/database';

@Controller('oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  /**
   * Google OAuth callback.
   * El state contiene el userId para asociar el token.
   */
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    if (error) {
      this.logger.warn(`Google OAuth error: ${error}`);
      res.status(400).send('Autorización cancelada. Puedes cerrar esta ventana.');
      return;
    }

    if (!code || !state) {
      res.status(400).send('Faltan parámetros. Intenta de nuevo desde Telegram.');
      return;
    }

    try {
      const userId = state;

      const tokens = await exchangeGoogleCode(code);

      const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

      await upsertOAuthToken({
        userId,
        provider: 'google',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        scope: tokens.scope,
        expiresAt,
      });

      this.logger.log(`Google OAuth completed for user ${userId}`);

      res.status(200).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2>✅ Calendario conectado</h2>
            <p>Ya puedes pedirle a tu asistente que vea o cree eventos en tu calendario.</p>
            <p>Puedes cerrar esta ventana y volver a Telegram.</p>
          </body>
        </html>
      `);
    } catch (err) {
      this.logger.error(`Google OAuth callback error: ${err}`);
      res.status(500).send('Error conectando el calendario. Intenta de nuevo.');
    }
  }
}
