import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import {
  CreatePaymentInputSchema,
  type CreatePaymentInput,
} from '@lavanderpro/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenantId } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PaymentsService } from './payments.service';

const ListPaymentsQuerySchema = z.object({
  orderId: z.string().uuid(),
});

@Controller('payments')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(CreatePaymentInputSchema))
    body: CreatePaymentInput,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.payments.create(body, tenantId);
  }

  @Get()
  list(
    @Query(new ZodValidationPipe(ListPaymentsQuerySchema))
    query: { orderId: string },
    @CurrentTenantId() tenantId: string,
  ) {
    return this.payments.listByOrder(query.orderId, tenantId);
  }
}
