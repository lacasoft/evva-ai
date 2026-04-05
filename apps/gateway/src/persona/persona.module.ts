import { Module, forwardRef } from "@nestjs/common";
import { PersonaService } from "./persona.service.js";
import { MemoryModule } from "../memory/memory.module.js";
import { ToolsModule } from "../tools/tools.module.js";

@Module({
  imports: [MemoryModule, forwardRef(() => ToolsModule)],
  providers: [PersonaService],
  exports: [PersonaService],
})
export class PersonaModule {}
