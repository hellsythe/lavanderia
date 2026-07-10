import {
  Body,
  Controller,
  ForbiddenException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  OnboardingStepInputSchema,
  UpdateTenantInputSchema,
  PresignLogoUploadRequestSchema,
  type OnboardingStepInput,
  type UpdateTenantInput,
  type PresignLogoUploadRequest,
  type PresignLogoUploadResponse,
} from '@lavanderpro/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import type { Tenant } from './domain/tenant.entity';
import { TenantsService } from './tenants.service';

/**
 * TenantsController — endpoints HTTP del bounded context de tenants.
 *
 * - PATCH /:id/onboarding — flujo de onboarding paso a paso
 * - PUT /:id — actualización de datos de la empresa (config)
 * - POST /:id/logo/presign — URL prefirmada para subir logo
 */
@Controller('tenants')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Patch(':id/onboarding')
  async updateOnboarding(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(OnboardingStepInputSchema))
    dto: OnboardingStepInput,
  ): Promise<Tenant> {
    if (user.role !== 'super_admin' && user.tenantId !== id) {
      throw new ForbiddenException('No puedes editar un tenant ajeno');
    }
    return this.tenants.updateOnboarding(id, user.id, user.role, dto);
  }

  /**
   * PUT /tenants/:id — actualiza datos de la empresa desde configuración.
   */
  @Put(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(UpdateTenantInputSchema))
    dto: UpdateTenantInput,
  ): Promise<Tenant> {
    if (user.role !== 'super_admin' && user.tenantId !== id) {
      throw new ForbiddenException('No puedes editar un tenant ajeno');
    }
    return this.tenants.update(id, dto);
  }

  /**
   * POST /tenants/:id/logo/presign — genera URL prefirmada PUT para
   * que el frontend suba el logo directamente a MinIO/S3.
   */
  @Post(':id/logo/presign')
  async presignLogoUpload(
    @Param('id', new ParseUUIDPipe()) tenantId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(PresignLogoUploadRequestSchema))
    dto: PresignLogoUploadRequest,
  ): Promise<PresignLogoUploadResponse> {
    if (user.role !== 'super_admin' && user.tenantId !== tenantId) {
      throw new ForbiddenException('No puedes editar un tenant ajeno');
    }
    return this.tenants.presignLogoUpload(tenantId, dto);
  }
}
