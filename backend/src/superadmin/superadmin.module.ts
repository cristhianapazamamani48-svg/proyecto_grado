import { Module } from '@nestjs/common';
import { SuperadminService } from './superadmin.service';
import { SuperadminController } from './superadmin.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SuperadminService],
  controllers: [SuperadminController],
  exports: [SuperadminService],
})
export class SuperadminModule {}
