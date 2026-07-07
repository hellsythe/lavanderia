import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import {
  CreateOrderInputSchema,
  OrderStatusSchema,
  type OrderStatus,
} from '@lavanderpro/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenantId } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { OrdersService } from './orders.service';

const ListOrdersQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((s) => (s ? (s.split(',') as OrderStatus[]) : undefined)),
  customerId: z.string().uuid().optional(),
  updatedSince: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const ChangeStatusSchema = z.object({
  status: OrderStatusSchema,
});

@Controller('orders')
@UseGuards(JwtAuthGuard, TenantGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateOrderInputSchema)) dto: z.infer<typeof CreateOrderInputSchema>,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.orders.create(dto, tenantId);
  }

  @Get()
  list(
    @Query(new ZodValidationPipe(ListOrdersQuerySchema))
    query: z.infer<typeof ListOrdersQuerySchema>,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.orders.list(tenantId, {
      status: query.status as any,
      customerId: query.customerId,
      updatedSince: query.updatedSince,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('counts')
  counts(@CurrentTenantId() tenantId: string) {
    return this.orders.countByStatus(tenantId);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.orders.findById(id, tenantId);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(ChangeStatusSchema)) body: z.infer<typeof ChangeStatusSchema>,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.orders.changeStatus(id, tenantId, body.status);
  }
}