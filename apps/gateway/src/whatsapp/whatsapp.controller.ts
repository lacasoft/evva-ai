import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  HttpCode,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import { WhatsAppService } from "./whatsapp.service.js";

// ============================================================
// WhatsApp Cloud API webhook types
// ============================================================

interface WhatsAppWebhookBody {
  object: string;
  entry?: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { phone_number_id: string };
        messages?: Array<WhatsAppIncomingMessage>;
        statuses?: unknown[];
      };
      field: string;
    }>;
  }>;
}

export interface WhatsAppIncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "audio" | "image" | "location" | "document" | "video";
  text?: { body: string };
  audio?: { id: string; mime_type: string };
  image?: { id: string; mime_type: string; caption?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  document?: { id: string; mime_type: string; filename?: string; caption?: string };
}

@Controller("whatsapp")
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(private readonly whatsAppService: WhatsAppService) {}

  // ============================================================
  // GET /api/whatsapp/webhook — Verification (Meta challenge)
  // ============================================================

  @Get("webhook")
  verifyWebhook(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
    @Res() res: Response,
  ): void {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === "subscribe" && token === verifyToken) {
      this.logger.log("WhatsApp webhook verified successfully");
      res.status(200).send(challenge);
    } else {
      this.logger.warn("WhatsApp webhook verification failed");
      res.status(403).send("Forbidden");
    }
  }

  // ============================================================
  // POST /api/whatsapp/webhook — Receive messages
  // ============================================================

  @Post("webhook")
  @HttpCode(200)
  async handleWebhook(@Body() body: WhatsAppWebhookBody): Promise<{ status: string }> {
    // WhatsApp expects 200 quickly; process asynchronously
    if (body.object !== "whatsapp_business_account") {
      return { status: "ignored" };
    }

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Ignore status updates (delivery receipts, read receipts)
    if (!value?.messages || value.messages.length === 0) {
      return { status: "no_messages" };
    }

    const message = value.messages[0];

    // Process in background so we return 200 immediately
    this.whatsAppService.handleMessage(message.from, message).catch((err) => {
      this.logger.error(`Error processing WhatsApp message: ${err}`);
    });

    return { status: "ok" };
  }
}
