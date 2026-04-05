import { Module } from "@nestjs/common";
import { TelegramService } from "./telegram.service.js";
import { TelegramController } from "./telegram.controller.js";
import { ConversationModule } from "../conversation/conversation.module.js";
import { UsersModule } from "../users/users.module.js";

@Module({
  imports: [ConversationModule, UsersModule],
  providers: [TelegramService],
  controllers: [TelegramController],
  exports: [TelegramService],
})
export class TelegramModule {}
