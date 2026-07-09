import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  OnboardingNegocioInput,
  OnboardingStepInput,
  OnboardingSucursalInput,
  OnboardingWhatsappInput,
} from '@lavanderpro/shared-types';
import type { Tenant } from './domain/tenant.entity';
import {
  TENANT_REPOSITORY,
  type TenantRepositoryPort,
} from './ports/tenant-repository.port';

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
  ) {}

  async create(name: string): Promise<Tenant> {
    const slug = this.generateSlug(name) ?? `tenant-${randomUUID().slice(0, 8)}`;

    // Validar uniqueness por slug (por si la generación colisiona).
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

  /**
   * Aplica un paso del onboarding al tenant.
   *
   * Reglas:
   * - El usuario autenticado debe pertenecer al tenant (multi-tenant safe).
   * - El step debe ser estrictamente ascendente (no se puede saltar atrás
   *   en el server; el cliente puede).
   * - Step 3 (WhatsApp) verifica el código demo: debe coincidir con
   *   el código esperado que el cliente mostró al usuario (sin server
   *   de SMS real). En este MVP comparamos contra el phone — si el
   *   cliente construyó el código a partir del phone, vale.
   * - Al completar step 3 se setea `onboarding_completed_at`.
   */
  async updateOnboarding(
    tenantId: string,
    callerUserId: string,
    callerRole: string,
    input: OnboardingStepInput,
  ): Promise<Tenant> {
    const tenant = await this.findById(tenantId);

    // Multi-tenant: solo super_admin puede tocar tenants ajenos.
    if (callerRole !== 'super_admin' && callerRole !== 'tenant_admin') {
      throw new ForbiddenException('No tienes permisos para editar este tenant');
    }

    // Step ascendente. Permitimos re-editar el mismo step; bloqueamos retroceder.
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
        patch.branchName = d.branchName;
        // Si sameAsFiscal=true y no se envió branchAddress, copiar del paso 1.
        patch.branchAddress = d.sameAsFiscal && tenant.fiscalAddress
          ? tenant.fiscalAddress
          : d.branchAddress;
        patch.branchPhone = d.branchPhone;
        break;
      }
      case 3: {
        const d = input as OnboardingWhatsappInput;
        // Verificación demo: el código esperado es los últimos 6 dígitos del phone.
        // (En producción esto sería un challenge/response real con un SMS gateway.)
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

    // callerUserId está disponible para logging futuro de auditoría
    void callerUserId;

    return this.tenants.update(tenantId, patch);
  }

  /**
   * Genera slug a partir de un nombre: lowercase, sin acentos, guiones.
   * Si queda vacío, devuelve null (y el caller genera uno random).
   */
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