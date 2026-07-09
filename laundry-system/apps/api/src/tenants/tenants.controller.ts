import {
  Body,
  Controller,
  ForbiddenException,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { type OnboardingStepInput, OnboardingStepInputSchema } from '@lavanderpro/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import type { Tenant } from './domain/tenant.entity';
import { TenantsService } from './tenants.service';

/**
 * TenantsController — endpoints HTTP del bounded context de tenants.
 *
 * Solo expone el PATCH usado por el onboarding (paso a paso).
 * El resto del módulo sigue siendo interno: otros bounded contexts
 * consumen TenantsService directamente, no por HTTP.
 */
@Controller('tenants')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  /**
   * Aplica un paso del onboarding al tenant.
   * Multi-tenant: solo el tenant_admin del mismo tenant (o super_admin).
   */
  @Patch(':id/onboarding')
  async updateOnboarding(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(OnboardingStepInputSchema))
    dto: OnboardingStepInput,
  ): Promise<Tenant> {
    // El :id de la URL debe coincidir con el tenant del JWT — defensa en profundidad
    // además del TenantGuard (que solo verifica presencia, no match).
    if (user.role !== 'super_admin' && user.tenantId !== id) {
      throw new ForbiddenException('No puedes editar un tenant ajeno');
    }
    return this.tenants.updateOnboarding(id, user.id, user.role, dto);
  }
}