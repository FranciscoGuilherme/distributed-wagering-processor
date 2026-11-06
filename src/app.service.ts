import { Injectable } from '@nestjs/common';
import { SYSTEM_MESSAGES } from './shared/constants/system-messages';

@Injectable()
export class AppService {
  getHello(): string {
    return SYSTEM_MESSAGES.HTTP.HELLO_WORLD;
  }
}
