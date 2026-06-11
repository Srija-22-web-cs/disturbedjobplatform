import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import {
  registerWorker,
  processHeartbeat,
  listWorkers,
  getWorkerById,
} from '../services/workerService';

const router = Router();

function validate(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'ValidationError', message: 'Invalid input', errors: errors.array() });
    return;
  }
  next();
}

// POST /api/workers/register
router.post(
  '/register',
  [body('name').isString().notEmpty().trim().withMessage('name is required')],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const worker = await registerWorker(req.body.name);
      res.status(201).json({ worker, message: 'Worker registered successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/workers/heartbeat
router.post(
  '/heartbeat',
  [body('workerId').isUUID().withMessage('workerId must be a valid UUID')],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await processHeartbeat(req.body.workerId);
      res.json({ success: true, message: 'Heartbeat received' });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/workers
router.get('/', async (_req, res, next) => {
  try {
    const workers = await listWorkers();
    res.json(workers);
  } catch (err) {
    next(err);
  }
});

// GET /api/workers/:id
router.get(
  '/:id',
  [param('id').isUUID()],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const worker = await getWorkerById(req.params.id);
      res.json(worker);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
