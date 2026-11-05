import { Injectable } from '@nestjs/common';

@Injectable()
export default class QueueManagerService {
  async processQueueMessage(data: any): Promise<void> {}
}
