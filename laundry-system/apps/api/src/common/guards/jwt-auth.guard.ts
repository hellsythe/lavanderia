import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Pasa el JWT payload validado a `req.user` para uso en controllers/services.
   * Si falla (no token / expirado / firma inválida) responde 401 automáticamente.
   */
}