import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo(): { name: string; status: string; version: string } {
    return {
      name: 'LavanderPro API',
      status: 'ok',
      version: '0.1.0',
    };
  }
}