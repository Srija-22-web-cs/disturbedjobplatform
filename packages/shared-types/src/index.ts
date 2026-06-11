// Job States
export enum JobStatus {
  QUEUED = 'QUEUED',
  ASSIGNED = 'ASSIGNED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

// Worker States
export enum WorkerStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

// Job Priority
export enum JobPriority {
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3,
}

// Core Models
export interface Worker {
  id: string;
  name: string;
  status: WorkerStatus;
  lastHeartbeat: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  priority: JobPriority;
  status: JobStatus;
  assignedWorkerId: string | null;
  assignedWorker?: Worker | null;
  retryCount: number;
  maxRetries: number;
  progress: number;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ExecutionHistory {
  id: string;
  jobId: string;
  job?: Job;
  workerId: string | null;
  worker?: Worker | null;
  status: JobStatus;
  logs: string[];
  startedAt: Date | string;
  completedAt: Date | string | null;
}

// API Request/Response Types
export interface CreateJobRequest {
  type: string;
  payload: Record<string, unknown>;
  priority?: JobPriority;
  maxRetries?: number;
}

export interface CreateJobResponse {
  job: Job;
  message: string;
}

export interface RegisterWorkerRequest {
  name: string;
}

export interface RegisterWorkerResponse {
  worker: Worker;
  message: string;
}

export interface HeartbeatRequest {
  workerId: string;
}

export interface HeartbeatResponse {
  success: boolean;
  message: string;
}

export interface JobStats {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  retrying: number;
  assigned: number;
  onlineWorkers: number;
  offlineWorkers: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// Socket Events
export enum SocketEvent {
  JOB_CREATED = 'job_created',
  JOB_ASSIGNED = 'job_assigned',
  JOB_STARTED = 'job_started',
  JOB_PROGRESS = 'job_progress',
  JOB_COMPLETED = 'job_completed',
  JOB_FAILED = 'job_failed',
  JOB_RETRIED = 'job_retried',
  WORKER_ONLINE = 'worker_online',
  WORKER_OFFLINE = 'worker_offline',
  STATS_UPDATED = 'stats_updated',
}

export interface JobProgressEvent {
  jobId: string;
  progress: number;
  status: JobStatus;
  workerId?: string;
}

export interface WorkerStatusEvent {
  workerId: string;
  workerName: string;
  status: WorkerStatus;
}

// BullMQ Job Data
export interface BullJobData {
  jobId: string;
  type: string;
  payload: Record<string, unknown>;
  priority: JobPriority;
  retryCount: number;
  maxRetries: number;
}
