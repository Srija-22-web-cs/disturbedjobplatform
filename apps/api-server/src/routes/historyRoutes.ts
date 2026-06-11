import { Router, Request, Response, NextFunction } from 'express';
import { query, validationResult } from 'express-validator';
import prisma from '../lib/prisma';

const router = Router();

function validate(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'ValidationError', errors: errors.array() });
    return;
  }
  next();
}

// GET /api/history
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('jobId').optional().isUUID(),
    query('workerId').optional().isUUID(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, (req.query.page as unknown as number) || 1);
      const pageSize = Math.min(100, (req.query.pageSize as unknown as number) || 20);
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {};
      if (req.query.jobId) where.jobId = req.query.jobId;
      if (req.query.workerId) where.workerId = req.query.workerId;

      const [history, total] = await Promise.all([
        prisma.executionHistory.findMany({
          where,
          include: {
            job: { select: { id: true, type: true, priority: true } },
            worker: { select: { id: true, name: true } },
          },
          orderBy: { startedAt: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.executionHistory.count({ where }),
      ]);

      res.json({
        data: history,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
