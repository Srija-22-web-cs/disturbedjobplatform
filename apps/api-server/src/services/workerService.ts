import { WorkerStatus, JobStatus } from '@distributed-job-platform/shared-types';
import { isHeartbeatStale } from '@distributed-job-platform/shared-utils';
import prisma from '../lib/prisma';
import { enqueueJob } from './queueService';
import { broadcastStats } from './jobService';
import { emitWorkerOnline, emitWorkerOffline } from '../socket/socketServer';
import { AppError } from '../middleware/errorHandler';
import logger from '../middleware/logger';

export async function registerWorker(name: string) {
  const existing = await prisma.worker.findUnique({ where: { name } });

  if (existing) {
    // Re-register existing worker (e.g., worker restarted)
    const worker = await prisma.worker.update({
      where: { id: existing.id },
      data: {
        status: WorkerStatus.ONLINE,
        lastHeartbeat: new Date(),
      },
    });
    emitWorkerOnline({ workerId: worker.id, workerName: worker.name, status: WorkerStatus.ONLINE });
    logger.info(`Worker re-registered: ${worker.id} (${worker.name})`);
    return worker;
  }

  const worker = await prisma.worker.create({
    data: {
      name,
      status: WorkerStatus.ONLINE,
      lastHeartbeat: new Date(),
    },
  });

  emitWorkerOnline({ workerId: worker.id, workerName: worker.name, status: WorkerStatus.ONLINE });
  await broadcastStats();
  logger.info(`Worker registered: ${worker.id} (${worker.name})`);
  return worker;
}

export async function processHeartbeat(workerId: string) {
  const worker = await prisma.worker.findUnique({ where: { id: workerId } });
  if (!worker) {
    throw new AppError(`Worker ${workerId} not found`, 404);
  }

  const updated = await prisma.worker.update({
    where: { id: workerId },
    data: {
      lastHeartbeat: new Date(),
      status: WorkerStatus.ONLINE,
    },
  });

  return updated;
}

export async function listWorkers() {
  return prisma.worker.findMany({
    include: {
      _count: { select: { jobs: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getWorkerById(id: string) {
  const worker = await prisma.worker.findUnique({
    where: { id },
    include: {
      jobs: {
        orderBy: { updatedAt: 'desc' },
        take: 20,
      },
    },
  });
  if (!worker) throw new AppError(`Worker ${id} not found`, 404);
  return worker;
}

// Called by scheduler to detect and handle dead workers
export async function detectAndHandleDeadWorkers(): Promise<number> {
  const threshold = new Date(Date.now() - 30000); // 30 seconds

  const deadWorkers = await prisma.worker.findMany({
    where: {
      status: WorkerStatus.ONLINE,
      lastHeartbeat: { lt: threshold },
    },
  });

  if (deadWorkers.length === 0) return 0;

  let recoveredJobs = 0;

  for (const worker of deadWorkers) {
    logger.warn(`Worker ${worker.id} (${worker.name}) heartbeat stale, marking OFFLINE`);

    // Mark worker offline
    await prisma.worker.update({
      where: { id: worker.id },
      data: { status: WorkerStatus.OFFLINE },
    });

    emitWorkerOffline({
      workerId: worker.id,
      workerName: worker.name,
      status: WorkerStatus.OFFLINE,
    });

    // Recover jobs assigned to this dead worker
    const abandonedJobs = await prisma.job.findMany({
      where: {
        assignedWorkerId: worker.id,
        status: { in: [JobStatus.ASSIGNED, JobStatus.RUNNING] },
      },
    });

    for (const job of abandonedJobs) {
      logger.warn(`Recovering abandoned job ${job.id} from dead worker ${worker.id}`);

      const canRetry = job.retryCount < job.maxRetries;
      const newStatus = canRetry ? JobStatus.QUEUED : JobStatus.FAILED;

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: newStatus,
          assignedWorkerId: null,
          progress: 0,
          retryCount: canRetry ? { increment: 1 } : undefined,
          errorMessage: `Worker ${worker.name} became unavailable`,
        },
      });

      // Add execution history entry for the recovery event
      await prisma.executionHistory.create({
        data: {
          jobId: job.id,
          workerId: worker.id,
          status: JobStatus.FAILED,
          logs: [`Worker ${worker.name} (${worker.id}) became unavailable. Job recovered.`],
          completedAt: new Date(),
        },
      });

      if (canRetry) {
        // Re-enqueue for processing
        await enqueueJob({
          jobId: job.id,
          type: job.type,
          payload: job.payload as Record<string, unknown>,
          priority: job.priority as any,
          retryCount: job.retryCount + 1,
          maxRetries: job.maxRetries,
        });
        recoveredJobs++;
      }
    }
  }

  if (deadWorkers.length > 0) {
    await broadcastStats();
  }

  return recoveredJobs;
}
