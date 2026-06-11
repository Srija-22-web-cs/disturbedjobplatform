/**
 * API Integration Tests
 * Uses Jest module mocking to avoid real DB/Redis connections.
 */

// ── Mocks must be declared before any imports ──────────────────────────────
const mockJob = {
  job: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(),
         update: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
  worker: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(),
            update: jest.fn(), groupBy: jest.fn() },
  executionHistory: { findMany: jest.fn(), count: jest.fn(),
                      create: jest.fn(), findFirst: jest.fn() },
  $on: jest.fn(),
};

jest.mock('../src/lib/prisma', () => ({ __esModule: true, default: mockJob }));

jest.mock('../src/services/queueService', () => ({
  enqueueJob: jest.fn().mockResolvedValue(undefined),
  getJobQueue: jest.fn().mockReturnValue({ add: jest.fn().mockResolvedValue({}) }),
  initializeQueue: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/socket/socketServer', () => ({
  emitJobCreated: jest.fn(), emitJobAssigned: jest.fn(), emitJobStarted: jest.fn(),
  emitJobCompleted: jest.fn(), emitJobFailed: jest.fn(), emitJobRetried: jest.fn(),
  emitJobProgress: jest.fn(), emitStatsUpdated: jest.fn(),
  emitWorkerOnline: jest.fn(), emitWorkerOffline: jest.fn(),
  initializeSocket: jest.fn(),
}));

// ── Imports after mocks ─────────────────────────────────────────────────────
import request from 'supertest';
import app from '../src/app';

// ── Helpers ─────────────────────────────────────────────────────────────────
const emptyStats = () => {
  mockJob.job.groupBy.mockResolvedValue([]);
  mockJob.worker.groupBy.mockResolvedValue([]);
};

const sampleJobId  = '550e8400-e29b-41d4-a716-446655440000';
const sampleWrkId  = '550e8400-e29b-41d4-a716-446655440002';

beforeEach(() => jest.clearAllMocks());

// ── Health ───────────────────────────────────────────────────────────────────
describe('Health', () => {
  it('GET /health → 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ── Jobs ─────────────────────────────────────────────────────────────────────
describe('Job API', () => {
  const baseJob = {
    id: sampleJobId, type: 'data-processing', payload: {},
    priority: 2, status: 'QUEUED', retryCount: 0, maxRetries: 3,
    progress: 0, result: null, errorMessage: null, assignedWorkerId: null,
    createdAt: new Date(), updatedAt: new Date(),
  };

  describe('POST /api/jobs', () => {
    it('creates a job → 201', async () => {
      mockJob.job.create.mockResolvedValue(baseJob);
      emptyStats();

      const res = await request(app).post('/api/jobs')
        .send({ type: 'data-processing', payload: { key: 'v' }, priority: 2 });

      expect(res.status).toBe(201);
      expect(res.body.job.type).toBe('data-processing');
      expect(res.body.message).toBe('Job created successfully');
    });

    it('rejects missing type → 400', async () => {
      const res = await request(app).post('/api/jobs').send({ payload: {} });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects priority > 3 → 400', async () => {
      const res = await request(app).post('/api/jobs').send({ type: 't', priority: 99 });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/jobs/stats', () => {
    it('returns stats → 200', async () => {
      mockJob.job.groupBy.mockResolvedValue([
        { status: 'QUEUED', _count: { _all: 5 } },
        { status: 'COMPLETED', _count: { _all: 10 } },
      ]);
      mockJob.worker.groupBy.mockResolvedValue([
        { status: 'ONLINE', _count: { _all: 3 } },
      ]);

      const res = await request(app).get('/api/jobs/stats');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(15);
      expect(res.body.queued).toBe(5);
      expect(res.body.completed).toBe(10);
      expect(res.body.onlineWorkers).toBe(3);
    });
  });

  describe('GET /api/jobs', () => {
    it('returns paginated list → 200', async () => {
      mockJob.job.findMany.mockResolvedValue([{ ...baseJob, assignedWorker: null }]);
      mockJob.job.count.mockResolvedValue(1);

      const res = await request(app).get('/api/jobs?page=1&pageSize=10');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.page).toBe(1);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('filters by status → 200', async () => {
      mockJob.job.findMany.mockResolvedValue([]);
      mockJob.job.count.mockResolvedValue(0);

      const res = await request(app).get('/api/jobs?status=RUNNING');
      expect(res.status).toBe(200);
    });

    it('rejects unknown status → 400', async () => {
      const res = await request(app).get('/api/jobs?status=INVALID');
      expect(res.status).toBe(400);
    });
  });
});

// ── Workers ───────────────────────────────────────────────────────────────────
describe('Worker API', () => {
  const baseWorker = {
    id: sampleWrkId, name: 'worker-test', status: 'ONLINE',
    lastHeartbeat: new Date(), createdAt: new Date(), updatedAt: new Date(),
  };

  describe('POST /api/workers/register', () => {
    it('registers new worker → 201', async () => {
      mockJob.worker.findUnique.mockResolvedValue(null);
      mockJob.worker.create.mockResolvedValue(baseWorker);
      emptyStats();

      const res = await request(app).post('/api/workers/register')
        .send({ name: 'worker-test' });

      expect(res.status).toBe(201);
      expect(res.body.worker.name).toBe('worker-test');
    });

    it('re-registers existing worker → 201', async () => {
      mockJob.worker.findUnique.mockResolvedValue(baseWorker);
      mockJob.worker.update.mockResolvedValue(baseWorker);

      const res = await request(app).post('/api/workers/register')
        .send({ name: 'worker-test' });

      expect(res.status).toBe(201);
    });

    it('rejects empty name → 400', async () => {
      const res = await request(app).post('/api/workers/register').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/workers/heartbeat', () => {
    it('accepts valid heartbeat → 200', async () => {
      mockJob.worker.findUnique.mockResolvedValue(baseWorker);
      mockJob.worker.update.mockResolvedValue(baseWorker);

      const res = await request(app).post('/api/workers/heartbeat')
        .send({ workerId: sampleWrkId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects non-UUID workerId → 400', async () => {
      const res = await request(app).post('/api/workers/heartbeat')
        .send({ workerId: 'not-a-uuid' });
      expect(res.status).toBe(400);
    });

    it('returns 404 for unknown worker', async () => {
      mockJob.worker.findUnique.mockResolvedValue(null);
      const res = await request(app).post('/api/workers/heartbeat')
        .send({ workerId: '550e8400-e29b-41d4-a716-446655440099' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/workers', () => {
    it('lists workers → 200', async () => {
      mockJob.worker.findMany.mockResolvedValue([{ ...baseWorker, _count: { jobs: 5 } }]);
      const res = await request(app).get('/api/workers');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});

// ── History ───────────────────────────────────────────────────────────────────
describe('History API', () => {
  it('GET /api/history → paginated 200', async () => {
    mockJob.executionHistory.findMany.mockResolvedValue([]);
    mockJob.executionHistory.count.mockResolvedValue(0);

    const res = await request(app).get('/api/history');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.total).toBe(0);
  });
});
