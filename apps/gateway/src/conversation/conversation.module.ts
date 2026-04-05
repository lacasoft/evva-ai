import { Module } from "@nestjs/common";
import { ConversationService } from "./conversation.service.js";
import { OnboardingService } from "./onboarding.service.js";
import { UsersModule } from "../users/users.module.js";
import { MemoryModule } from "../memory/memory.module.js";
import { PersonaModule } from "../persona/persona.module.js";
import { ToolsModule } from "../tools/tools.module.js";
import { SchedulerModule } from "../scheduler/scheduler.module.js";

@Module({
  imports: [
    UsersModule,
    MemoryModule,
    PersonaModule,
    ToolsModule,
    SchedulerModule,
  ],
  providers: [ConversationService, OnboardingService],
  exports: [ConversationService, OnboardingService],
})
export class ConversationModule {}
