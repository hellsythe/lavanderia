import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateBranchInputSchema, UpdateBranchInputSchema, type CreateBranchInput, type UpdateBranchInput } from '@lavanderpro/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenantId } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { BranchesService } from './branches.service';

@Controller('branches')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.branches.list(tenantId);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.branches.findById(id, tenantId);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateBranchInputSchema)) body: CreateBranchInput,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.branches.create(body, tenantId);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateBranchInputSchema)) body: UpdateBranchInput,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.branches.update(id, tenantId, body);
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.branches.softDelete(id, tenantId);
  }
}
