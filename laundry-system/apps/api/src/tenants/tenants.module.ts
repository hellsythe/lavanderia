import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantOrmEntity } from './infrastructure/tenant.orm-entity';
import {
  TENANT_REPOSITORY,
} from './ports/tenant-repository.port';
import { TypeormTenantRepository } from './infrastructure/typeorm-tenant.repository';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { BranchesModule } from '../branches/branches.module';

@Module({
  imports: [TypeOrmModule.forFeature([TenantOrmEntity]), BranchesModule],
  controllers: [TenantsController],
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