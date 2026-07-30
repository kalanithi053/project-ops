import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() {
    return {
      status: 'ok',
      service: 'project-ops',
      time: new Date().toISOString(),
    };
  }
}
