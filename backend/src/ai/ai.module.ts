import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiService } from './ai.service';
import { MockAIProvider } from './providers/mock-ai.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { ClaudeProvider } from './providers/claude.provider';

@Module({
  imports: [PrismaModule],
  providers: [AiService, MockAIProvider, OpenAIProvider, GeminiProvider, ClaudeProvider],
  exports: [AiService],
})
export class AiModule {}
