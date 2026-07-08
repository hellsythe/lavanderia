import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenantId } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateCustomerInputSchema,
  UpdateCustomerInputSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from '@lavanderpro/shared-types';
import { CustomersService } from './customers.service';

const ListCustomersQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

@Controller('customers')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(
    @CurrentTenantId() tenantId: string,
    @Query(new ZodValidationPipe(ListCustomersQuerySchema))
    query: { search?: string; limit?: number; offset?: number },
  ) {
    return this.customers.list(tenantId, query);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.customers.findById(id, tenantId);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateCustomerInputSchema)) body: CreateCustomerInput,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.customers.create(body, tenantId);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(UpdateCustomerInputSchema)) body: UpdateCustomerInput,
  ) {
    return this.customers.update(id, tenantId, body);
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.customers.softDelete(id, tenantId);
  }
}