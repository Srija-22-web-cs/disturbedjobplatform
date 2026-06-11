import { JobStatus, JobPriority, BullJobData } from '@distributed-job-platform/shared-types';
import { calculateBackoff } from '@distributed-job-platform/shared-utils';
import prisma from '../lib/prisma';
import { enqueueJob } from './queueService';
import {
  emitJobCreated,
  emitJobRetried,
  emitStatsUpdated,
} from '../socket/socketServer';
import { AppError } from '../middleware/errorHandler';
import logger from '../middleware/logger';

export async function createJob(params: {
  type: string;
  payload: Record<string, unknown>;
  priority?: number;
  maxRetries?: number;
}) {
  const job = await prisma.job.create({
    data: {
      type: params.type,
      payload: params.payload,
      priority: params.priority ?? JobPriority.MEDIUM,
      maxRetries: params.maxRetries ?? 3,
      status: JobStatus.QUEUED,
    },
  });

  // Push to BullMQ
  const bullData: BullJobData = {
    jobId: job.id,
    type: job.type,
    payload: job.payload as Record<string, unknown>,
    priority: job.priority as JobPriority,
    retryCount: job.retryCount,
    maxRetries: job.maxRetries,
  };
  await enqueueJob(bullData);

  emitJobCreated(job as any);
  await broadcastStats();
  logger.info(`Job created: ${job.id} type=${job.type} priority=${job.priority}`);
  return job;
}

export async function listJobs(params: {
  page?: number;
  pageSize?: number;
  status?: JobStatus;
  type?: string;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  if (params.type) where.type = params.type;

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      include: { assignedWorker: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: pageSize,
    }),
    prisma.job.count({ where }),
  ]);

  return {
    data: jobs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getJobById(id: string) {
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      assignedWorker: true,
      executionHistory: {
        orderBy: { startedAt: 'desc' },
        take: 10,
        include: { worker: true },
      },
    },
  });

  if (!job) {
    throw new AppError(`Job ${id} not found`, 404);
  }
  return job;
}

export async function retryJob(id: string) {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    throw new AppError(`Job ${id} not found`, 404);
  }
  if (job.status !== JobStatus.FAILED) {
    throw new AppError(`Job ${id} is not in FAILED state (current: ${job.status})`, 400);
  }

  const delay = calculateBackoff(job.retryCount);

  const updated = await prisma.job.update({
    where: { id },
    data: {
      status: JobStatus.RETRYING,
      retryCount: { increment: 1 },
      progress: 0,
      errorMessage: null,
      assignedWorkerId: null,
    },
  });

  // Re-enqueue with backoff delay
  const bullData: BullJobData = {
    jobId: updated.id,
    type: updated.type,
    payload: updated.payload as Record<string, unknown>,
    priority: updated.priority as JobPriority,
    retryCount: updated.retryCount,
    maxRetries: updated.maxRetries,
  };

  const { getJobQueue } = await import('./queueService');
  const queue = getJobQueue();
  await queue.add(`retry-${updated.id}-${updated.retryCount}`, bullData, {
    delay,
    priority: updated.priority === JobPriority.HIGH ? 10 : updated.priority === JobPriority.MEDIUM ? 5 : 1,
  });

  emitJobRetried(updated as any);
  await broadcastStats();
  logger.info(`Job ${id} queued for retry (attempt ${updated.retryCount}, delay ${delay}ms)`);
  return updated;
}

export async function getJobStats() {
  const [statusCounts, workerCounts] = await Promise.all([
    prisma.job.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.worker.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ]);

  const stats = {
    total: 0,
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    retrying: 0,
    assigned: 0,
    onlineWorkers: 0,
    offlineWorkers: 0,
  };

  for (const row of statusCounts) {
    stats.total += row._count._all;
    const key = row.status.toLowerCase() as keyof typeof stats;
    if (key in stats) {
      (stats as any)[key] = row._count._all;
    }
  }

  for (const row of workerCounts) {
    if (row.status === 'ONLINE') stats.onlineWorkers = row._count._all;
    if (row.status === 'OFFLINE') stats.offlineWorkers = row._count._all;
  }

  return stats;
}

export async function broadcastStats() {
  try {
    const stats = await getJobStats();
    emitStatsUpdated(stats);
  } catch (err) {
    logger.error('Failed to broadcast stats:', err);
  }
}
