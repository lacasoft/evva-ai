import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduledJobProcessor } from "./processors/scheduled-job.processor.js";
import { FactExtractionProcessor } from "./processors/fact-extraction.processor.js";
import { DailyBriefingProcessor } from "./processors/daily-briefing.processor.js";
import { TelegramSenderService } from "./handlers/telegram-sender.service.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env", "../../.env.local", "../../.env"],
    }),
  ],
  providers: [
    TelegramSenderService,
    ScheduledJobProcessor,
    FactExtractionProcessor,
    DailyBriefingProcessor,
  ],
})
export class WorkerAppModule {}
