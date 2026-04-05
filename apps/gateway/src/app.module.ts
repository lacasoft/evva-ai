import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { TelegramModule } from "./telegram/telegram.module.js";
import { ConversationModule } from "./conversation/conversation.module.js";
import { MemoryModule } from "./memory/memory.module.js";
import { SchedulerModule } from "./scheduler/scheduler.module.js";
import { UsersModule } from "./users/users.module.js";
import { PersonaModule } from "./persona/persona.module.js";
import { ToolsModule } from "./tools/tools.module.js";
import { HealthModule } from "./health/health.module.js";
import { OAuthModule } from "./oauth/oauth.module.js";
import { appConfig } from "./config/app.config.js";

@Module({
  imports: [
    // Config global — disponible en todos los módulos
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: [".env.local", ".env", "../../.env.local", "../../.env"],
    }),

    // Scheduler para tareas cron
    ScheduleModule.forRoot(),

    // Módulos del dominio
    HealthModule,
    OAuthModule,
    UsersModule,
    PersonaModule,
    MemoryModule,
    ToolsModule,
    ConversationModule,
    SchedulerModule,

    // Telegram al final — depende de los demás módulos
    TelegramModule,
  ],
})
export class AppModule {}
