import { JobStatus, JobPriority } from '@distributed-job-platform/shared-types';

// Retry backoff calculation
export function calculateBackoff(retryCount: number, baseDelayMs = 1000): number {
  return Math.min(baseDelayMs * Math.pow(2, retryCount), 30000);
}

// Format duration in ms to human-readable
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

// Format date to relative time
export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 10) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// Status badge color helpers
export function getJobStatusColor(status: JobStatus): string {
  const colors: Record<JobStatus, string> = {
    [JobStatus.QUEUED]: 'blue',
    [JobStatus.ASSIGNED]: 'purple',
    [JobStatus.RUNNING]: 'yellow',
    [JobStatus.COMPLETED]: 'green',
    [JobStatus.FAILED]: 'red',
    [JobStatus.RETRYING]: 'orange',
  };
  return colors[status] || 'gray';
}

// Priority label
export function getPriorityLabel(priority: JobPriority): string {
  const labels: Record<JobPriority, string> = {
    [JobPriority.HIGH]: 'High',
    [JobPriority.MEDIUM]: 'Medium',
    [JobPriority.LOW]: 'Low',
  };
  return labels[priority] || 'Unknown';
}

// Generate worker name
export function generateWorkerName(): string {
  const adjectives = ['swift', 'eager', 'brave', 'calm', 'deft', 'keen', 'wise', 'bold'];
  const nouns = ['falcon', 'bear', 'wolf', 'hawk', 'lion', 'fox', 'elk', 'owl'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `worker-${adj}-${noun}-${num}`;
}

// Check if heartbeat is stale (>30 seconds)
export function isHeartbeatStale(lastHeartbeat: Date | string, thresholdMs = 30000): boolean {
  const d = new Date(lastHeartbeat);
  return Date.now() - d.getTime() > thresholdMs;
}

// Safe JSON parse
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

// Truncate string
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
