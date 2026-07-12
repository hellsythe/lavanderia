import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type {
  OnboardingNegocioInput,
  OnboardingStepInput,
  OnboardingSucursalInput,
  OnboardingWhatsappInput,
  PresignLogoUploadRequest,
  PresignLogoUploadResponse,
  UpdateTenantInput,
} from '@lavanderpro/shared-types';
import type { Tenant } from './domain/tenant.entity';
import {
  TENANT_REPOSITORY,
  type TenantRepositoryPort,
} from './ports/tenant-repository.port';
import { StorageService } from '../storage/storage.service';
import { BranchesService } from '../branches/branches.service';

/**
 * TenantsService — use cases del bounded context de tenants.
 *
 * Cualquier otro módulo (auth, orders) que necesite un Tenant debe
 * llamar a este service, no al repositorio directamente.
 */
@Injectable()
export class TenantsService {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenants: TenantRepositoryPort,
    private readonly storage: StorageService,
    private readonly branches: BranchesService,
  ) {}

  async create(name: string): Promise<Tenant> {
    const slug = this.generateSlug(name) ?? `tenant-${randomUUID().slice(0, 8)}`;

    const existing = await this.tenants.findBySlug(slug);
    if (existing) {
      throw new ConflictException(`Ya existe un tenant con el slug "${slug}"`);
    }

    return this.tenants.create({
      name,
      slug,
      plan: 'trial',
    });
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenants.findById(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} no encontrado`);
    }
    return tenant;
  }

  async updateOnboarding(
    tenantId: string,
    callerUserId: string,
    callerRole: string,
    input: OnboardingStepInput,
  ): Promise<Tenant> {
    const tenant = await this.findById(tenantId);

    if (callerRole !== 'super_admin' && callerRole !== 'tenant_admin') {
      throw new ForbiddenException('No tienes permisos para editar este tenant');
    }

    if (input.step < tenant.onboardingStep) {
      throw new BadRequestException(
        `No puedes retroceder al step ${input.step} (actual: ${tenant.onboardingStep})`,
      );
    }

    const now = Date.now();
    const patch: Partial<Tenant> = { onboardingStep: input.step };

    switch (input.step) {
      case 1: {
        const d = input as OnboardingNegocioInput;
        patch.fiscalName = d.fiscalName;
        patch.fiscalAddress = d.fiscalAddress;
        patch.fiscalTaxId = d.fiscalTaxId;
        break;
      }
      case 2: {
        const d = input as OnboardingSucursalInput;
        const address =
          d.sameAsFiscal && tenant.fiscalAddress ? tenant.fiscalAddress : d.branchAddress;
        await this.branches.create(
          {
            name: d.branchName,
            address: address,
            phone: d.branchPhone,
            isMain: true,
          },
          tenantId,
        );
        break;
      }
      case 3: {
        const d = input as OnboardingWhatsappInput;
        const expected = d.whatsappPhone.replace(/\D/g, '').slice(-6).padStart(6, '0');
        if (d.whatsappCode !== expected) {
          throw new BadRequestException('Código de verificación incorrecto');
        }
        patch.whatsappPhone = d.whatsappPhone;
        patch.whatsappVerifiedAt = now;
        patch.onboardingCompletedAt = now;
        break;
      }
    }

    void callerUserId;
    return this.tenants.update(tenantId, patch);
  }

  /**
   * PUT /tenants/:id — actualiza datos de la empresa desde el módulo
   * de configuración (nombre, fiscales, sucursal, whatsapp, logoUrl).
   */
  async update(tenantId: string, input: UpdateTenantInput): Promise<Tenant> {
    await this.findById(tenantId);

    const patch: Partial<Tenant> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.fiscalName !== undefined) patch.fiscalName = input.fiscalName;
    if (input.fiscalAddress !== undefined) patch.fiscalAddress = input.fiscalAddress;
    if (input.fiscalTaxId !== undefined) patch.fiscalTaxId = input.fiscalTaxId;
    if (input.whatsappPhone !== undefined) patch.whatsappPhone = input.whatsappPhone;
    if (input.logoUrl !== undefined) patch.logoUrl = input.logoUrl;

    return this.tenants.update(tenantId, patch);
  }

  /**
   * POST /tenants/:id/logo/presign — genera URL prefirmada para que
   * el cliente suba el logo directamente a MinIO/S3.
   */
  async presignLogoUpload(
    tenantId: string,
    dto: PresignLogoUploadRequest,
  ): Promise<PresignLogoUploadResponse> {
    const ext = path.extname(dto.filename) || '.png';
    const uuid = randomUUID();
    const key = `tenants/${tenantId}/logo/${uuid}${ext}`;

    const result = await this.storage.getPresignedPutUrl(key, dto.contentType);
    return result;
  }

  private generateSlug(name: string): string | null {
    return (
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || null
    );
  }
}
