import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenantId } from '../common/decorators/current-user.decorator';
import { SyncService } from './sync.service';
import {
  SyncPushBatchSchema,
  type SyncPullResponse,
  type SyncPushBatch,
} from '@lavanderpro/shared-types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

/**
 * Schema para query params de GET /sync/changes.
 * `since` viene como string desde la URL, lo coercemos a number.
 */
const SyncPullQuerySchema = z.object({
  since: z.coerce.number().int().nonnegative().optional(),
});

@Controller('sync')
@UseGuards(JwtAuthGuard, TenantGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  /**
   * GET /api/sync/changes?since=<ms>
   * Devuelve todos los cambios (orders, customers, services) del tenant
   * con `updatedAt > since`. `since=0` (o ausente) → todo.
   */
  @Get('changes')
  async getChanges(
    @CurrentTenantId() tenantId: string,
    @Query(new ZodValidationPipe(SyncPullQuerySchema))
    query: { since?: number },
  ): Promise<SyncPullResponse> {
    return this.sync.getChanges(tenantId, query.since ?? 0);
  }

  /**
   * POST /api/sync/batch
   * Recibe un batch de operaciones offline del cliente. Aplica con
   * last-write-wins y registra los cambios para que otros clientes los pullen.
   */
  @Post('batch')
  async pushBatch(
    @Body(new ZodValidationPipe(SyncPushBatchSchema)) body: SyncPushBatch,
    @CurrentTenantId() tenantId: string,
  ): Promise<{ accepted: number; rejected: number }> {
    return this.sync.pushBatch(tenantId, body.operations);
  }
}