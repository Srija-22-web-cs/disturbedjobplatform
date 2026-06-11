import { JobStatus } from '@distributed-job-platform/shared-types';
import { detectAndHandleDeadWorkers } from '../services/workerService';
import { broadcastStats } from '../services/jobService';
import prisma from '../lib/prisma';
import logger from '../middleware/logger';

const HEARTBEAT_CHECK_INTERVAL = 10_000; // every 10 seconds
const STATS_BROADCAST_INTERVAL = 5_000;  // every 5 seconds

let heartbeatTimer: NodeJS.Timer | null = null;
let statsTimer: NodeJS.Timer | null = null;

export function startScheduler(): void {
  logger.info('Starting background scheduler...');

  // Heartbeat monitor: detect dead workers and recover jobs
  heartbeatTimer = setInterval(async () => {
    try {
      const recovered = await detectAndHandleDeadWorkers();
      if (recovered > 0) {
        logger.info(`Scheduler: recovered ${recovered} abandoned jobs`);
      }

      // Also handle any RETRYING jobs that got stuck
      await requeueStuckJobs();
    } catch (err) {
      logger.error('Scheduler heartbeat check error:', err);
    }
  }, HEARTBEAT_CHECK_INTERVAL);

  // Periodic stats broadcast
  statsTimer = setInterval(async () => {
    try {
      await broadcastStats();
    } catch (err) {
      logger.error('Scheduler stats broadcast error:', err);
    }
  }, STATS_BROADCAST_INTERVAL);

  logger.info('Scheduler started');
}

export function stopScheduler(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer as NodeJS.Timeout);
    heartbeatTimer = null;
  }
  if (statsTimer) {
    clearInterval(statsTimer as NodeJS.Timeout);
    statsTimer = null;
  }
  logger.info('Scheduler stopped');
}

// Re-queue any RETRYING jobs that have been stuck for more than 60 seconds
async function requeueStuckJobs(): Promise<void> {
  const stuckThreshold = new Date(Date.now() - 60_000);

  const stuckJobs = await prisma.job.findMany({
    where: {
      status: JobStatus.RETRYING,
      updatedAt: { lt: stuckThreshold },
    },
  });

  for (const job of stuckJobs) {
    logger.warn(`Re-queuing stuck RETRYING job ${job.id}`);
    await prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.QUEUED },
    });
  }
}
