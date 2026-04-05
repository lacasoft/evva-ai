import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service.js';

@Module({
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
