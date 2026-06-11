import { Queue, QueueEvents } from 'bullmq';
import { BullJobData, JobPriority } from '@distributed-job-platform/shared-types';
import logger from '../middleware/logger';

export const QUEUE_NAME = 'job-execution';

let jobQueue: Queue<BullJobData> | null = null;
let queueEvents: QueueEvents | null = null;

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null as null,
  enableReadyCheck: false,
};

export async function initializeQueue(): Promise<void> {
  const connection = redisConnection;

  jobQueue = new Queue<BullJobData>(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 100, age: 86400 }, // keep last 100 or 24h
      removeOnFail: { count: 50 },
      attempts: 1, // we handle retries manually in our scheduler
    },
  });

  queueEvents = new QueueEvents(QUEUE_NAME, { connection: redisConnection });

  queueEvents.on('completed', ({ jobId }) => {
    logger.debug(`BullMQ job ${jobId} completed`);
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.debug(`BullMQ job ${jobId} failed: ${failedReason}`);
  });

  await jobQueue.waitUntilReady();
  logger.info('BullMQ queue initialized');
}

export function getJobQueue(): Queue<BullJobData> {
  if (!jobQueue) {
    throw new Error('Queue not initialized. Call initializeQueue() first.');
  }
  return jobQueue;
}

// Map our priority (1=high, 2=medium, 3=low) to BullMQ priority (higher number = higher priority)
function toBullPriority(priority: number): number {
  const map: Record<number, number> = {
    [JobPriority.HIGH]: 10,
    [JobPriority.MEDIUM]: 5,
    [JobPriority.LOW]: 1,
  };
  return map[priority] ?? 5;
}

export async function enqueueJob(data: BullJobData): Promise<void> {
  const queue = getJobQueue();
  await queue.add(`job-${data.jobId}`, data, {
    priority: toBullPriority(data.priority),
    jobId: data.jobId,
  });
  logger.info(`Enqueued job ${data.jobId} with priority ${data.priority}`);
}

export async function getQueueMetrics() {
  const queue = getJobQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}
