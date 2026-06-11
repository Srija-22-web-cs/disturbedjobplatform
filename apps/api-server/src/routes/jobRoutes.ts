import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { JobPriority, JobStatus } from '@distributed-job-platform/shared-types';
import {
  createJob,
  listJobs,
  getJobById,
  retryJob,
  getJobStats,
} from '../services/jobService';

const router = Router();

function validate(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'ValidationError', message: 'Invalid input', errors: errors.array() });
    return;
  }
  next();
}

// GET /api/jobs/stats
router.get('/stats', async (_req, res, next) => {
  try {
    const stats = await getJobStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(Object.values(JobStatus)),
    query('type').optional().isString().trim(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await listJobs({
        page: req.query.page as unknown as number,
        pageSize: req.query.pageSize as unknown as number,
        status: req.query.status as JobStatus,
        type: req.query.type as string,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/jobs
router.post(
  '/',
  [
    body('type').isString().notEmpty().trim().withMessage('type is required'),
    body('payload').optional().isObject().withMessage('payload must be a JSON object'),
    body('priority')
      .optional()
      .isInt({ min: 1, max: 3 })
      .withMessage('priority must be 1 (HIGH), 2 (MEDIUM), or 3 (LOW)'),
    body('maxRetries').optional().isInt({ min: 0, max: 10 }).withMessage('maxRetries must be 0-10'),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await createJob({
        type: req.body.type,
        payload: req.body.payload || {},
        priority: req.body.priority ?? JobPriority.MEDIUM,
        maxRetries: req.body.maxRetries ?? 3,
      });
      res.status(201).json({ job, message: 'Job created successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/jobs/:id
router.get(
  '/:id',
  [param('id').isUUID().withMessage('id must be a valid UUID')],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await getJobById(req.params.id);
      res.json(job);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/jobs/:id/retry
router.post(
  '/:id/retry',
  [param('id').isUUID().withMessage('id must be a valid UUID')],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await retryJob(req.params.id);
      res.json({ job, message: 'Job queued for retry' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
