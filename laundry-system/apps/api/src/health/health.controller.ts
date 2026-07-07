import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; timestamp: number } {
    return { status: 'ok', timestamp: Date.now() };
  }
}