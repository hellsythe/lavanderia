import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCustomerInputSchema, UpdateCustomerInputSchema, type CreateCustomerInput, type UpdateCustomerInput } from '@lavanderpro/shared-types';
import { Customer } from './domain/customer.entity';
import {
  CUSTOMER_REPOSITORY,
  type CustomerListFilters,
  type CustomerRepositoryPort,
} from './ports/customer-repository.port';

@Injectable()
export class CustomersService {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customers: CustomerRepositoryPort,
  ) {}

  async list(tenantId: string, filters: CustomerListFilters) {
    return this.customers.list(tenantId, filters);
  }

  async findById(id: string, tenantId: string): Promise<Customer> {
    const c = await this.customers.findById(id, tenantId);
    if (!c) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return c;
  }

  async create(input: CreateCustomerInput, tenantId: string): Promise<Customer> {
    const parsed = CreateCustomerInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Datos inválidos',
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const data = parsed.data;

    const existing = await this.customers.findByName(data.name, tenantId);
    if (existing) {
      throw new ConflictException(`Ya existe un cliente activo con el nombre "${data.name}"`);
    }
    return this.customers.create({
      id: data.id, // Respetamos id del cliente si lo envía (offline-first).
      tenantId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      address: data.address,
      notes: data.notes,
      rfc: data.rfc,
      legalName: data.legalName,
    });
  }

  async update(
    id: string,
    tenantId: string,
    input: UpdateCustomerInput,
  ): Promise<Customer> {
    const parsed = UpdateCustomerInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Datos inválidos',
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const existing = await this.findById(id, tenantId);
    const data = parsed.data;

    // Si cambia el name, validar que no choque con otro customer activo
    if (data.name && data.name !== existing.name) {
      const sameName = await this.customers.findByName(data.name, tenantId);
      if (sameName && sameName.id !== id) {
        throw new ConflictException(`Ya existe un cliente activo con el nombre "${data.name}"`);
      }
    }

    // Helper para distinguir "no enviado" (undefined) de "explícitamente null" (clear).
    // El repo acepta undefined = no tocar, null = borrar. La diferencia
    // entre null y undefined en el input la dicta la transformación Zod.
    const applyField = <T,>(newValue: T | null | undefined, currentValue: T | undefined): T | undefined => {
      if (newValue === null) return undefined; // explicit null → clear
      if (newValue === undefined) return currentValue; // not sent → keep
      return newValue; // new value → set
    };

    return this.customers.update({
      ...existing,
      name: data.name ?? existing.name,
      phone: applyField(data.phone, existing.phone),
      email: applyField(data.email, existing.email),
      address: applyField(data.address, existing.address),
      notes: applyField(data.notes, existing.notes),
      rfc: applyField(data.rfc, existing.rfc),
      legalName: applyField(data.legalName, existing.legalName),
    });
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    // Verificar que existe (lanza 404 si no)
    await this.findById(id, tenantId);
    await this.customers.softDelete(id, tenantId);
  }
}