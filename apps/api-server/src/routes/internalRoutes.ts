import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { JobStatus } from '@distributed-job-platform/shared-types';
import prisma from '../lib/prisma';
import {
  emitJobAssigned,
  emitJobStarted,
  emitJobProgress,
  emitJobCompleted,
  emitJobFailed,
} from '../socket/socketServer';
import { broadcastStats } from '../services/jobService';
import logger from '../middleware/logger';

const router = Router();

function validate(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'ValidationError', errors: errors.array() });
    return;
  }
  next();
}

// PATCH /api/jobs/:id/status (called by worker)
router.patch(
  '/:id/status',
  [
    param('id').isUUID(),
    body('status').isIn(Object.values(JobStatus)),
    body('workerId').isUUID(),
    body('progress').optional().isInt({ min: 0, max: 100 }),
    body('result').optional(),
    body('errorMessage').optional().isString(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status, workerId, progress, result, errorMessage } = req.body;

    try {
      const existing = await prisma.job.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Not Found', message: `Job ${id} not found` });
        return;
      }

      const updated = await prisma.job.update({
        where: { id },
        data: {
          status,
          assignedWorkerId: workerId,
          ...(progress !== undefined && { progress }),
          ...(result !== undefined && { result }),
          ...(errorMessage !== undefined && { errorMessage }),
        },
        include: { assignedWorker: true },
      });

      // Create or update execution history
      if (status === JobStatus.RUNNING || status === JobStatus.ASSIGNED) {
        // Find or create history entry for this run
        const existingHistory = await prisma.executionHistory.findFirst({
          where: { jobId: id, workerId, completedAt: null },
          orderBy: { startedAt: 'desc' },
        });

        if (!existingHistory) {
          await prisma.executionHistory.create({
            data: {
              jobId: id,
              workerId,
              status: JobStatus.RUNNING,
              logs: [`[${new Date().toISOString()}] Job assigned to worker ${workerId}`],
            },
          });
        } else {
          await prisma.executionHistory.update({
            where: { id: existingHistory.id },
            data: {
              status,
              logs: {
                push: `[${new Date().toISOString()}] Status: ${status}`,
              },
            },
          });
        }
      }

      if (status === JobStatus.COMPLETED || status === JobStatus.FAILED || status === JobStatus.RETRYING) {
        // Complete the history entry
        const historyEntry = await prisma.executionHistory.findFirst({
          where: { jobId: id, workerId, completedAt: null },
          orderBy: { startedAt: 'desc' },
        });

        if (historyEntry) {
          const log =
            status === JobStatus.COMPLETED
              ? `[${new Date().toISOString()}] Job completed successfully`
              : `[${new Date().toISOString()}] Job ${status.toLowerCase()}: ${errorMessage || 'Unknown error'}`;

          await prisma.executionHistory.update({
            where: { id: historyEntry.id },
            data: {
              status,
              completedAt: new Date(),
              logs: { push: log },
            },
          });
        }
      }

      // Emit socket events
      switch (status) {
        case JobStatus.ASSIGNED:
          emitJobAssigned(updated as any);
          break;
        case JobStatus.RUNNING:
          emitJobStarted(updated as any);
          break;
        case JobStatus.COMPLETED:
          emitJobCompleted(updated as any);
          break;
        case JobStatus.FAILED:
        case JobStatus.RETRYING:
          emitJobFailed(updated as any);
          break;
      }

      await broadcastStats();
      res.json({ job: updated });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/jobs/:id/progress (called by worker for progress updates)
router.patch(
  '/:id/progress',
  [
    param('id').isUUID(),
    body('progress').isInt({ min: 0, max: 100 }),
    body('workerId').isUUID(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { progress, workerId } = req.body;

    try {
      await prisma.job.update({
        where: { id },
        data: { progress },
      });

      emitJobProgress({ jobId: id, progress, status: JobStatus.RUNNING, workerId });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
