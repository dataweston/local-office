import { Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';

import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';
import { LABELS_QUEUE, LABELS_QUEUE_NAME, queueConnection } from './queues.constants';

@Injectable()
class LabelsQueueProvider implements OnModuleDestroy {
  readonly queue = new Queue(LABELS_QUEUE_NAME, queueConnection);

  async onModuleDestroy() {
    await this.queue.close();
  }
}

@Module({
  controllers: [BatchesController],
  providers: [
    BatchesService,
    LabelsQueueProvider,
    {
      provide: LABELS_QUEUE,
      useFactory: (provider: LabelsQueueProvider) => provider.queue,
      inject: [LabelsQueueProvider]
    }
  ]
})
export class BatchesModule {}
