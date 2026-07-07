import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantOrmEntity } from './infrastructure/tenant.orm-entity';
import {
  TENANT_REPOSITORY,
} from './ports/tenant-repository.port';
import { TypeormTenantRepository } from './infrastructure/typeorm-tenant.repository';
import { TenantsService } from './tenants.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantOrmEntity])],
  providers: [
    TenantsService,
    {
      provide: TENANT_REPOSITORY,
      useClass: TypeormTenantRepository,
    },
  ],
  exports: [TenantsService],
})
export class TenantsModule {}