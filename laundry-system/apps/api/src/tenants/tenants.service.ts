import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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