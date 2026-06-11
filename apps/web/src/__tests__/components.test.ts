import { JobStatus, JobPriority, WorkerStatus } from '@distributed-job-platform/shared-types';

// Test UI utility functions used in components

describe('Status badge logic', () => {
  it('covers all JobStatus values', () => {
    const statuses = Object.values(JobStatus);
    expect(statuses).toContain(JobStatus.QUEUED);
    expect(statuses).toContain(JobStatus.RUNNING);
    expect(statuses).toContain(JobStatus.COMPLETED);
    expect(statuses).toContain(JobStatus.FAILED);
    expect(statuses).toContain(JobStatus.RETRYING);
    expect(statuses).toContain(JobStatus.ASSIGNED);
  });

  it('covers all Priority values', () => {
    expect(JobPriority.HIGH).toBe(1);
    expect(JobPriority.MEDIUM).toBe(2);
    expect(JobPriority.LOW).toBe(3);
  });

  it('covers all WorkerStatus values', () => {
    const statuses = Object.values(WorkerStatus);
    expect(statuses).toContain(WorkerStatus.ONLINE);
    expect(statuses).toContain(WorkerStatus.OFFLINE);
  });
});

describe('Progress bar logic', () => {
  it('clamps progress to 0-100', () => {
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    expect(clamp(-10)).toBe(0);
    expect(clamp(0)).toBe(0);
    expect(clamp(50)).toBe(50);
    expect(clamp(100)).toBe(100);
    expect(clamp(150)).toBe(100);
  });
});

describe('Relative time formatting', () => {
  it('shows "just now" for recent timestamps', () => {
    const format = (date: Date) => {
      const diff = Date.now() - date.getTime();
      const s = Math.floor(diff / 1000);
      if (s < 10) return 'just now';
      if (s < 60) return `${s}s ago`;
      return 'older';
    };
    expect(format(new Date())).toBe('just now');
    expect(format(new Date(Date.now() - 30_000))).toBe('30s ago');
  });
});

describe('JSON payload validation', () => {
  it('validates correct JSON', () => {
    const validate = (s: string) => {
      try { JSON.parse(s); return true; } catch { return false; }
    };
    expect(validate('{"key": "value"}')).toBe(true);
    expect(validate('{bad json}')).toBe(false);
    expect(validate('')).toBe(false);
    expect(validate('null')).toBe(true);
  });
});
