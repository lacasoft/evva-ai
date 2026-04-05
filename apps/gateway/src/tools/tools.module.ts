import { Module } from "@nestjs/common";
import { ToolsService } from "./tools.service.js";
import { SchedulerModule } from "../scheduler/scheduler.module.js";
import { MemoryModule } from "../memory/memory.module.js";

@Module({
  imports: [SchedulerModule, MemoryModule],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class ToolsModule {}
