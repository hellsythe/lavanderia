import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { USER_REPOSITORY, UserRepositoryPort } from './ports/user-repository.port';
import { TenantsService } from '../tenants/tenants.service';

export interface JwtPayload {
  sub: string; // user id
  tenantId: string;
  role: string;
  tokenVersion: number;
  type: 'access' | 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  tenantName: string;
  name: string;
  email: string;
  password: string;
}

export interface AuthResult {
  tokens: AuthTokens;
  user: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    role: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    private readonly tenants: TenantsService,
    private readonly jwt: JwtService,
  ) {}

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);
    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tenant = await this.tenants.findById(user.tenantId);
    const tokens = await this.generateTokens(user.id, user.tenantId, user.role, user.tokenVersion);

    return {
      tokens,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tenant: tenant
        ? { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan }
        : { id: user.tenantId, name: '', slug: '', plan: 'trial' },
    };
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con ese correo');
    }

    // Delega al módulo Tenants — Auth NO crea tenants directamente.
    const tenant = await this.tenants.create(input.tenantName);

    await this.users.create({
      tenantId: tenant.id,
      email: input.email,
      name: input.name,
      role: 'tenant_admin',
      passwordHash: await bcrypt.hash(input.password, 10),
      active: true,
    });

    const user = await this.users.findByEmail(input.email);
    if (!user) {
      throw new Error('Usuario no encontrado tras registro');
    }

    const tokens = await this.generateTokens(user.id, user.tenantId, user.role, user.tokenVersion);

    return {
      tokens,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
      },
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token no es de tipo refresh');
    }

    const user = await this.users.findById(payload.sub);
    if (!user || !user.active || user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Token revocado');
    }

    return this.generateTokens(user.id, user.tenantId, user.role, user.tokenVersion);
  }

  private async generateTokens(
    userId: string,
    tenantId: string,
    role: string,
    tokenVersion: number,
  ): Promise<AuthTokens> {
    const base: Omit<JwtPayload, 'type'> = {
      sub: userId,
      tenantId,
      role,
      tokenVersion,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ ...base, type: 'access' }, { expiresIn: '15m' }),
      this.jwt.signAsync({ ...base, type: 'refresh' }, { expiresIn: '60d' }),
    ]);

    return { accessToken, refreshToken, expiresIn: 60 * 15 };
  }
}