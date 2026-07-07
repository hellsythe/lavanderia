import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { z } from 'zod';
import { LoginInputSchema, RegisterInputSchema } from '@lavanderpro/shared-types';
import { AuthService, type AuthResult } from './auth.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(LoginInputSchema)) dto: z.infer<typeof LoginInputSchema>,
  ): Promise<AuthResult> {
    return this.auth.login(dto);
  }

  @Post('register')
  @HttpCode(201)
  async register(
    @Body(new ZodValidationPipe(RegisterInputSchema)) dto: z.infer<typeof RegisterInputSchema>,
  ): Promise<AuthResult> {
    return this.auth.register(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body(new ZodValidationPipe(RefreshSchema)) dto: z.infer<typeof RefreshSchema>,
  ) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  me() {
    return { ok: true };
  }
}