import { Module } from "@nestjs/common";
import { WhatsAppController } from "./whatsapp.controller.js";
import { WhatsAppService } from "./whatsapp.service.js";
import { ConversationModule } from "../conversation/conversation.module.js";
import { UsersModule } from "../users/users.module.js";

@Module({
  imports: [ConversationModule, UsersModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
