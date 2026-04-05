import { Module } from "@nestjs/common";
import { OAuthController } from "./oauth.controller.js";

@Module({
  controllers: [OAuthController],
})
export class OAuthModule {}
