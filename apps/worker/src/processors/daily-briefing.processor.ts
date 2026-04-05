import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  getUsersWithBriefingAt,
  getUserNotes,
  getAllUserFacts,
} from "@evva/database";
import { generateResponse } from "@evva/ai";
import { TelegramSenderService } from "../handlers/telegram-sender.service.js";

@Injectable()
export class DailyBriefingProcessor implements OnModuleInit {
  private readonly logger = new Logger(DailyBriefingProcessor.name);
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(private readonly telegramSender: TelegramSenderService) {}

  onModuleInit() {
    // Revisar cada minuto si hay briefings que enviar
    this.intervalId = setInterval(() => {
      this.checkAndSendBriefings().catch((err) => {
        this.logger.error(`Briefing check failed: ${err}`);
      });
    }, 60_000);

    this.logger.log("DailyBriefingProcessor iniciado — revisando cada minuto");
  }

  private async checkAndSendBriefings(): Promise<void> {
    // Obtener hora UTC actual
    const now = new Date();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();

    // Buscar usuarios que tienen briefing configurado a esta hora UTC
    // TODO: Convertir a timezone del usuario — por ahora usa UTC
    const users = await getUsersWithBriefingAt(hour, minute);

    if (users.length === 0) return;

    this.logger.log(`Enviando briefing diario a ${users.length} usuarios`);

    for (const user of users) {
      try {
        await this.sendBriefing(user);
      } catch (err) {
        this.logger.error(`Failed to send briefing to ${user.userId}: ${err}`);
      }
    }
  }

  private async sendBriefing(user: {
    userId: string;
    telegramId: number;
    timezone: string;
    language: "es" | "en";
    telegramFirstName?: string;
    assistantName: string;
  }): Promise<void> {
    // Recopilar contexto del usuario
    const [notes, facts] = await Promise.all([
      getUserNotes(user.userId),
      getAllUserFacts(user.userId),
    ]);

    const activeNotes = notes.filter((n) => !n.isArchived);
    const pinnedNotes = activeNotes.filter((n) => n.isPinned);
    const lists = activeNotes.filter((n) => n.isList);
    const uncheckedItems = lists.flatMap((n) =>
      (n.items ?? [])
        .filter((i) => !i.checked)
        .map((i) => `${n.title}: ${i.text}`),
    );

    const now = new Date().toLocaleString(
      user.language === "es" ? "es-MX" : "en-US",
      {
        timeZone: user.timezone,
        weekday: "long",
        month: "long",
        day: "numeric",
      },
    );

    // Construir prompt para el briefing
    const contextParts: string[] = [];

    if (activeNotes.length > 0) {
      contextParts.push(`Notas activas (${activeNotes.length}):`);
      for (const note of activeNotes.slice(0, 10)) {
        if (note.isList) {
          const pending = (note.items ?? []).filter((i) => !i.checked);
          contextParts.push(
            `- Lista "${note.title}": ${pending.length} items pendientes`,
          );
        } else {
          contextParts.push(`- Nota "${note.title}"`);
        }
      }
    }

    // Detectar cumpleanos proximos
    const today = new Date();
    const birthdayFacts = facts.filter(
      (f) =>
        f.content.toLowerCase().includes("cumple") ||
        f.content.toLowerCase().includes("birthday"),
    );

    const upcomingBirthdays = birthdayFacts
      .map((f) => {
        const dateMatch = f.content.match(/(\d{1,2})[\/\-](\d{1,2})/);
        if (!dateMatch) return null;
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1;
        const next = new Date(today.getFullYear(), month, day);
        if (next < today) next.setFullYear(today.getFullYear() + 1);
        const daysUntil = Math.ceil(
          (next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        return { fact: f.content, daysUntil };
      })
      .filter(
        (b): b is NonNullable<typeof b> => b !== null && b.daysUntil <= 7,
      )
      .sort((a, b) => a.daysUntil - b.daysUntil);

    if (upcomingBirthdays.length > 0) {
      contextParts.push("\nCumpleanos proximos (7 dias):");
      for (const b of upcomingBirthdays) {
        contextParts.push(
          `- ${b.fact} (${b.daysUntil === 0 ? "HOY" : `en ${b.daysUntil} dias`})`,
        );
      }
    }

    if (facts.length > 0) {
      contextParts.push(
        `\nDatos que recuerdas del usuario (${facts.length} facts):`,
      );
      for (const fact of facts.slice(0, 5)) {
        contextParts.push(`- ${fact.content}`);
      }
    }

    const systemPrompt = `Eres ${user.assistantName}, el asistente personal de ${user.telegramFirstName ?? "tu usuario"}.
Es ${now}. Envía el resumen diario matutino.

Contexto actual del usuario:
${contextParts.length > 0 ? contextParts.join("\n") : "No hay notas ni pendientes guardados."}

Instrucciones:
- Saluda brevemente y da el resumen del día
- Si hay listas con items pendientes, menciónalas
- Si hay notas fijadas, menciónalas
- Sé conciso, cálido y útil
- Termina preguntando si necesita algo
- NO inventes información que no está en el contexto`;

    const response = await generateResponse({
      systemPrompt,
      messages: [{ role: "user", content: "Genera el resumen diario." }],
      maxTokens: 512,
      temperature: 0.7,
    });

    const message = response.text?.trim();
    if (!message) {
      this.logger.warn(`Empty briefing for user ${user.userId}`);
      return;
    }

    await this.telegramSender.send(user.telegramId, message);
    this.logger.log(
      `Daily briefing sent to ${user.telegramFirstName ?? user.userId}`,
    );
  }
}
