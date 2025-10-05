import pino from 'pino';
import type { Job } from 'bullmq';

type AsyncHandler<T = unknown> = (job: Job) => Promise<T>;

const logger = pino({ name: 'local-office-worker' });

export function withJobLogging<T>(queueName: string, handler: AsyncHandler<T>): AsyncHandler<T> {
  return async (job) => {
    const start = Date.now();
    logger.info({ queue: queueName, jobId: job.id, name: job.name }, 'job started');
    try {
      const result = await handler(job);
      logger.info(
        { queue: queueName, jobId: job.id, durationMs: Date.now() - start },
        'job completed'
      );
      return result;
    } catch (error) {
      logger.error({ queue: queueName, jobId: job.id, error }, 'job failed');
      throw error;
    }
  };
}

export function getLogger() {
  return logger;
}
