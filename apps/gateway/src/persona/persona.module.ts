import { Module } from "@nestjs/common";
import { PersonaService } from "./persona.service.js";
import { MemoryModule } from "../memory/memory.module.js";

@Module({
  imports: [MemoryModule],
  providers: [PersonaService],
  exports: [PersonaService],
})
export class PersonaModule {}
