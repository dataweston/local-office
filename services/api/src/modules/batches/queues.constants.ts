export const LABELS_QUEUE = Symbol('LABELS_QUEUE');
export const LABELS_QUEUE_NAME = 'labels';
export const queueConnection = {
  connection: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379'
  }
};
