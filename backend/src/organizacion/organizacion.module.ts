import { Module } from '@nestjs/common';
import { OrganizacionService } from './organizacion.service';
import { OrganizacionController } from './organizacion.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [OrganizacionService],
  controllers: [OrganizacionController],
  exports: [OrganizacionService],
})
export class OrganizacionModule {}
