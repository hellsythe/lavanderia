import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { User } from '../domain/user.entity';
import type { UserRepositoryPort } from '../ports/user-repository.port';
import { UserOrmEntity } from './user.orm-entity';

/**
 * TypeORM implementation of UserRepositoryPort.
 *
 * Multi-tenant: las queries filtran SIEMPRE por tenantId (donde aplique).
 * Para crear tenants usa TenantsModule (no este repositorio).
 */
@Injectable()
export class TypeormUserRepository implements UserRepositoryPort {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repo: Repository<UserOrmEntity>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { email } });
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async create(
    user: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'tokenVersion'>,
  ): Promise<User> {
    const row = this.repo.create({
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
      passwordHash: user.passwordHash,
      active: user.active,
    });
    const saved = await this.repo.save(row);
    return this.toDomain(saved);
  }

  private toDomain(row: UserOrmEntity): User {
    return {
      id: row.id,
      tenantId: row.tenantId,
      email: row.email,
      name: row.name,
      role: row.role,
      passwordHash: row.passwordHash,
      active: row.active,
      tokenVersion: row.tokenVersion,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    };
  }
}