import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchOrmEntity } from './infrastructure/branch.orm-entity';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { BRANCH_REPOSITORY } from './ports/branch-repository.port';
import { TypeormBranchRepository } from './infrastructure/typeorm-branch.repository';

@Module({
  imports: [TypeOrmModule.forFeature([BranchOrmEntity])],
  controllers: [BranchesController],
  providers: [
    BranchesService,
    { provide: BRANCH_REPOSITORY, useClass: TypeormBranchRepository },
  ],
  exports: [BranchesService],
})
export class BranchesModule {}
