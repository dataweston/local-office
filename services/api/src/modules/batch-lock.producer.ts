import { Injectable } from '@nestjs/common';
import { enqueueBatchLock } from '@local-office/worker';
import { createIdempotencyKey } from '@local-office/lib';

type EnqueueOptions = Parameters<typeof enqueueBatchLock>[1];

@Injectable()
export class BatchLockProducer {
  async enqueueLock(data: Record<string, unknown>, opts?: EnqueueOptions) {
    const payload = {
      ...data,
      idempotencyKey:
        (data['idempotencyKey'] as string | undefined) ??
        createIdempotencyKey('batch-lock')
    };

    return enqueueBatchLock(payload, opts);
  }
}
