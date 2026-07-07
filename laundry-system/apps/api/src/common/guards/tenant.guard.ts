import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * TenantGuard — extrae `req.user.tenantId` (puesto por JwtStrategy)
 * y lo expone en `req.tenantId` para uso downstream.
 *
 * Combinado con un GlobalQueryFilter (futuro) garantiza que ninguna query
 * toque datos de otro tenant.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.tenantId) {
      throw new ForbiddenException('Tenant inválido o ausente en el token');
    }
    req.tenantId = user.tenantId;
    return true;
  }
}