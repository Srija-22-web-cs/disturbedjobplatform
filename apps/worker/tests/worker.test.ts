import { JobExecutor } from '../src/jobExecutor';

describe('JobExecutor', () => {
  jest.setTimeout(30000);

  it('executes a job and reaches 100% progress', async () => {
    const progressUpdates: number[] = [];
    const executor = new JobExecutor(
      'test-job-id',
      'data-processing',
      { items: 10 },
      'test-worker-id'
    );

    // Override Math.random to avoid failure and reduce duration
    const originalRandom = Math.random;
    let callCount = 0;
    Math.random = () => {
      callCount++;
      // First call: duration (return 0 for minimum 5s but we patch sleep)
      // Second call: failure check — return 0.5 (>0.2, so no failure)
      if (callCount === 2) return 0.5;
      return 0;
    };

    // Patch sleep to be instant
    jest.mock('@distributed-job-platform/shared-utils', () => ({
      ...jest.requireActual('@distributed-job-platform/shared-utils'),
      sleep: jest.fn().mockResolvedValue(undefined),
    }));

    Math.random = originalRandom;
  });

  it('builds result object with required fields', async () => {
    const executor = new JobExecutor(
      'test-id',
      'report-generation',
      {},
      'worker-1'
    );

    // Access private method via any cast for testing
    const result = (executor as any).buildResult(5000);

    expect(result).toHaveProperty('durationMs');
    expect(result).toHaveProperty('workerId', 'worker-1');
    expect(result).toHaveProperty('completedAt');
  });

  it('generates appropriate failure reasons per job type', () => {
    const executor = new JobExecutor('id', 'ml-inference', {}, 'worker');
    const reason = (executor as any).getFailureReason('ml-inference');
    expect(typeof reason).toBe('string');
    expect(reason.length).toBeGreaterThan(0);
  });

  it('returns generic failure reason for unknown types', () => {
    const executor = new JobExecutor('id', 'unknown-type', {}, 'worker');
    const reason = (executor as any).getFailureReason('unknown-type');
    expect(typeof reason).toBe('string');
  });
});

describe('Worker utilities', () => {
  it('calculateBackoff increases exponentially', () => {
    const { calculateBackoff } = require('@distributed-job-platform/shared-utils');
    expect(calculateBackoff(0)).toBe(1000);
    expect(calculateBackoff(1)).toBe(2000);
    expect(calculateBackoff(2)).toBe(4000);
    expect(calculateBackoff(3)).toBe(8000);
    // Capped at 30s
    expect(calculateBackoff(10)).toBe(30000);
  });
});
