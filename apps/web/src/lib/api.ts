import {
  Job,
  Worker,
  ExecutionHistory,
  JobStats,
  CreateJobRequest,
  PaginatedResponse,
  JobStatus,
} from '@distributed-job-platform/shared-types';

const API_BASE =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    : process.env.NEXT_PUBLIC_API_URL || 'http://api-server:3001';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message || `API error ${res.status}`);
  }

  return res.json();
}

// Jobs
export async function fetchJobs(params?: {
  page?: number;
  pageSize?: number;
  status?: JobStatus;
}): Promise<PaginatedResponse<Job & { assignedWorker: Worker | null }>> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  if (params?.status) q.set('status', params.status);
  return apiFetch(`/api/jobs?${q}`);
}

export async function fetchJob(id: string): Promise<Job & { assignedWorker: Worker | null; executionHistory: ExecutionHistory[] }> {
  return apiFetch(`/api/jobs/${id}`);
}

export async function createJob(data: CreateJobRequest): Promise<{ job: Job; message: string }> {
  return apiFetch('/api/jobs', { method: 'POST', body: JSON.stringify(data) });
}

export async function retryJob(id: string): Promise<{ job: Job; message: string }> {
  return apiFetch(`/api/jobs/${id}/retry`, { method: 'POST' });
}

export async function fetchJobStats(): Promise<JobStats> {
  return apiFetch('/api/jobs/stats');
}

// Workers
export async function fetchWorkers(): Promise<(Worker & { _count: { jobs: number } })[]> {
  return apiFetch('/api/workers');
}

// History
export async function fetchHistory(params?: {
  page?: number;
  pageSize?: number;
  jobId?: string;
}): Promise<PaginatedResponse<ExecutionHistory & { job: { id: string; type: string; priority: number } | null; worker: { id: string; name: string } | null }>> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  if (params?.jobId) q.set('jobId', params.jobId);
  return apiFetch(`/api/history?${q}`);
}
