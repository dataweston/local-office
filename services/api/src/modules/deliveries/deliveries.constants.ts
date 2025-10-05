export const DELIVERY_ADAPTERS = Symbol('DELIVERY_ADAPTERS');
export const DELIVERY_UPDATES_QUEUE = Symbol('DELIVERY_UPDATES_QUEUE');
export const DELIVERY_UPDATES_QUEUE_NAME = 'delivery-updates';
export const DELIVERY_UPDATE_JOB_NAME = 'delivery-update';

export const queueConnection = {
  connection: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379'
  }
};
