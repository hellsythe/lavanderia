import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateServiceCategoryInputSchema,
  CreateServiceInputSchema,
  UpdateServiceCategoryInputSchema,
  UpdateServiceInputSchema,
  type CreateServiceCategoryInput,
  type CreateServiceInput,
  type UpdateServiceCategoryInput,
  type UpdateServiceInput,
} from '@lavanderpro/shared-types';
import {
  SERVICE_CATEGORY_REPOSITORY,
  SERVICE_REPOSITORY,
  type ServiceCategoryRepositoryPort,
  type ServiceRepositoryPort,
} from './ports/service-repository.port';
import type { Service, ServiceCategory } from './domain/service.entity';

/**
 * Normaliza un campo opcional nullable de un UpdateInput.
 * Si el campo es `null` → `null` (clear).
 * Si el campo es `undefined` → no se toca (se queda el valor existente).
 * Si el campo es un string → ese string.
 */
function normalizeField<T extends string | null>(input: T | null | undefined, existing: T): T {
  if (input === null) return null as T;
  if (input === undefined) return existing;
  return input;
}

@Injectable()
export class ServicesService {
  constructor(
    @Inject(SERVICE_REPOSITORY)
    private readonly services: ServiceRepositoryPort,
    @Inject(SERVICE_CATEGORY_REPOSITORY)
    private readonly categories: ServiceCategoryRepositoryPort,
  ) {}

  // === Services ===

  async listServices(tenantId: string, filters: { categoryId?: string; onlyActive?: boolean; search?: string; limit?: number; offset?: number }) {
    return this.services.list(tenantId, filters);
  }

  async findServiceById(id: string, tenantId: string): Promise<Service> {
    const s = await this.services.findById(id, tenantId);
    if (!s) throw new NotFoundException(`Servicio ${id} no encontrado`);
    return s;
  }

  async createService(input: CreateServiceInput, tenantId: string): Promise<Service> {
    const parsed = CreateServiceInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Datos inválidos',
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const data = parsed.data;
    const existing = await this.services.findByName(data.name, tenantId);
    if (existing) {
      throw new ConflictException(`Ya existe un servicio activo con el nombre "${data.name}"`);
    }
    return this.services.create({
      tenantId,
      categoryId: data.categoryId ?? null,
      name: data.name,
      description: data.description ?? null,
      unit: data.unit,
      unitPrice: data.unitPrice,
      minQuantity: data.minQuantity,
      active: data.active,
    });
  }

  async updateService(
    id: string,
    tenantId: string,
    input: UpdateServiceInput,
  ): Promise<Service> {
    const parsed = UpdateServiceInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Datos inválidos',
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const existing = await this.findServiceById(id, tenantId);
    const data = parsed.data;

    if (data.name && data.name !== existing.name) {
      const sameName = await this.services.findByName(data.name, tenantId);
      if (sameName && sameName.id !== id) {
        throw new ConflictException(`Ya existe un servicio activo con el nombre "${data.name}"`);
      }
    }

    return this.services.update({
      id: existing.id,
      tenantId: existing.tenantId,
      categoryId: normalizeField(data.categoryId, existing.categoryId),
      description: normalizeField(data.description, existing.description),
      name: data.name ?? existing.name,
      unit: data.unit ?? existing.unit,
      unitPrice: data.unitPrice ?? existing.unitPrice,
      minQuantity: data.minQuantity ?? existing.minQuantity,
      active: data.active ?? existing.active,
      deletedAt: existing.deletedAt,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    });
  }

  async softDeleteService(id: string, tenantId: string): Promise<void> {
    await this.findServiceById(id, tenantId);
    await this.services.softDelete(id, tenantId);
  }

  // === Categories ===

  async listCategories(tenantId: string, filters: { limit?: number; offset?: number }) {
    return this.categories.list(tenantId, filters);
  }

  async findCategoryById(id: string, tenantId: string): Promise<ServiceCategory> {
    const c = await this.categories.findById(id, tenantId);
    if (!c) throw new NotFoundException(`Categoría ${id} no encontrada`);
    return c;
  }

  async createCategory(input: CreateServiceCategoryInput, tenantId: string): Promise<ServiceCategory> {
    const parsed = CreateServiceCategoryInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Datos inválidos',
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const data = parsed.data;
    const existing = await this.categories.findByName(data.name, tenantId);
    if (existing) {
      throw new ConflictException(`Ya existe una categoría activa con el nombre "${data.name}"`);
    }
    return this.categories.create({ tenantId, name: data.name });
  }

  async updateCategory(
    id: string,
    tenantId: string,
    input: UpdateServiceCategoryInput,
  ): Promise<ServiceCategory> {
    const parsed = UpdateServiceCategoryInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Datos inválidos',
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const existing = await this.findCategoryById(id, tenantId);
    const data = parsed.data;
    if (data.name && data.name !== existing.name) {
      const sameName = await this.categories.findByName(data.name, tenantId);
      if (sameName && sameName.id !== id) {
        throw new ConflictException(`Ya existe una categoría activa con el nombre "${data.name}"`);
      }
    }
    return this.categories.update({
      ...existing,
      deletedAt: existing.deletedAt ?? null,
      name: data.name ?? existing.name,
    });
  }

  async softDeleteCategory(id: string, tenantId: string): Promise<void> {
    await this.findCategoryById(id, tenantId);
    await this.categories.softDelete(id, tenantId);
  }
}