import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceOrmEntity } from './infrastructure/entities/service.orm-entity';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import {
  SERVICE_CATEGORY_REPOSITORY,
  SERVICE_REPOSITORY,
} from './ports/service-repository.port';
import {
  TypeormServiceCategoryRepository,
  TypeormServiceRepository,
} from './infrastructure/typeorm-service.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceOrmEntity])],
  controllers: [ServicesController],
  providers: [
    ServicesService,
    {
      provide: SERVICE_REPOSITORY,
      useClass: TypeormServiceRepository,
    },
    {
      provide: SERVICE_CATEGORY_REPOSITORY,
      useClass: TypeormServiceCategoryRepository,
    },
  ],
  exports: [ServicesService],
})
export class ServicesModule {}