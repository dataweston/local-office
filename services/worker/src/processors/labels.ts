import type { PrismaClient } from '@local-office/db';
import type { Job } from 'bullmq';

import { createLabelJob, type LabelJobData, type LabelJobDependencies, type LabelJobResult } from '../jobs/labels';
import type { ObjectStorageClient } from '../storage';

export interface LabelsJobData {
  batchId: string;
}

export interface LabelsProcessorDependencies extends Omit<LabelJobDependencies, 'storage'> {
  prisma: PrismaClient;
  storage: ObjectStorageClient;
}

export function createLabelsProcessor({ prisma, storage, now, renderLabels }: LabelsProcessorDependencies) {
  const handler = createLabelJob(prisma, { storage, now, renderLabels });

  return async (job: Job<LabelsJobData>): Promise<LabelJobResult> => {
    const batchId = job.data?.batchId;

    if (!batchId) {
      throw new Error('batchId is required to generate labels');
    }

    const [result] = await handler(job as unknown as Job<LabelJobData>);
    return result;
  };
}
