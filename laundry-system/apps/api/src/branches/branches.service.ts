import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBranchInputSchema, type Branch, type CreateBranchInput, type UpdateBranchInput } from './domain/branch.entity';
import { BRANCH_REPOSITORY, type BranchRepositoryPort } from './ports/branch-repository.port';

@Injectable()
export class BranchesService {
  constructor(
    @Inject(BRANCH_REPOSITORY)
    private readonly branches: BranchRepositoryPort,
  ) {}

  async list(tenantId: string): Promise<Branch[]> {
    return this.branches.listByTenant(tenantId);
  }

  async findById(id: string, tenantId: string): Promise<Branch> {
    const b = await this.branches.findById(id, tenantId);
    if (!b) throw new NotFoundException(`Sucursal ${id} no encontrada`);
    return b;
  }

  async findMain(tenantId: string): Promise<Branch | null> {
    return this.branches.findByMain(tenantId);
  }

  async create(input: CreateBranchInput, tenantId: string): Promise<Branch> {
    const parsed = CreateBranchInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Datos inválidos',
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    return this.branches.create(parsed.data, tenantId);
  }

  async update(
    id: string,
    tenantId: string,
    input: UpdateBranchInput,
  ): Promise<Branch> {
    await this.findById(id, tenantId);
    return this.branches.update(id, tenantId, input);
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    const branch = await this.findById(id, tenantId);
    if (branch.isMain) {
      throw new BadRequestException(
        'No se puede eliminar la sucursal principal. Promové otra a principal primero.',
      );
    }
    await this.branches.softDelete(id, tenantId);
  }
}
