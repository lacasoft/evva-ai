import { Module } from "@nestjs/common";
import { PersonaService } from "./persona.service.js";
import { MemoryModule } from "../memory/memory.module.js";
import { UsersModule } from "../users/users.module.js";

@Module({
  imports: [MemoryModule, UsersModule],
  providers: [PersonaService],
  exports: [PersonaService],
})
export class PersonaModule {}
