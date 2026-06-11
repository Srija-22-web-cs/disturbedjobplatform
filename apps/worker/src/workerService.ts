import axios from 'axios';
import { Worker as BullWorker, Job as BullJob } from 'bullmq';
import {
  BullJobData,
  JobStatus,
  WorkerStatus,
} from '@distributed-job-platform/shared-types';
import { sleep, calculateBackoff } from '@distributed-job-platform/shared-utils';
import { JobExecutor } from './jobExecutor';
import logger from './logger';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const QUEUE_NAME = 'job-execution';
const HEARTBEAT_INTERVAL = 10_000; // 10 seconds

export class WorkerService {
  private workerId: string | null = null;
  private workerName: string;
  private heartbeatTimer: NodeJS.Timer | null = null;
  private bullWorker: BullWorker | null = null;
  private redisConnection: {
    host: string;
    port: number;
    password?: string;
    maxRetriesPerRequest: null;
    enableReadyCheck: boolean;
  };

  constructor(name: string) {
    this.workerName = name;
    this.redisConnection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }

  async register(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.post(`${API_BASE}/api/workers/register`, {
          name: this.workerName,
        });
        this.workerId = response.data.worker.id;
        logger.info(`Registered as worker ${this.workerId} (${this.workerName})`);
        return;
      } catch (err) {
        attempts++;
        const delay = calculateBackoff(attempts, 2000);
        logger.warn(`Registration attempt ${attempts}/${maxAttempts} failed, retrying in ${delay}ms...`);
        if (attempts >= maxAttempts) throw err;
        await sleep(delay);
      }
    }
  }

  startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      if (!this.workerId) return;
      try {
        await axios.post(`${API_BASE}/api/workers/heartbeat`, {
          workerId: this.workerId,
        });
        logger.debug(`Heartbeat sent for worker ${this.workerId}`);
      } catch (err) {
        logger.error('Heartbeat failed:', err);
      }
    }, HEARTBEAT_INTERVAL);

    logger.info(`Heartbeat started (every ${HEARTBEAT_INTERVAL / 1000}s)`);
  }

  async startProcessing(): Promise<void> {
    if (!this.workerId) {
      throw new Error('Worker not registered');
    }

    const workerId = this.workerId;

    this.bullWorker = new BullWorker<BullJobData>(
      QUEUE_NAME,
      async (bullJob: BullJob<BullJobData>) => {
        return this.processJob(bullJob, workerId);
      },
      {
        connection: this.redisConnection,
        concurrency: 1,
        lockDuration: 60_000,
      }
    );

    this.bullWorker.on('completed', (job) => {
      logger.info(`BullMQ: job ${job.id} completed`);
    });

    this.bullWorker.on('failed', (job, err) => {
      logger.error(`BullMQ: job ${job?.id} failed:`, err);
    });

    this.bullWorker.on('error', (err) => {
      logger.error('BullMQ worker error:', err);
    });

    logger.info(`Worker ${workerId} listening for jobs on queue: ${QUEUE_NAME}`);
    // Keep alive
    await new Promise(() => {});
  }

  private async processJob(bullJob: BullJob<BullJobData>, workerId: string): Promise<void> {
    const { jobId, type, payload, maxRetries, retryCount } = bullJob.data;
    logger.info(`Processing job ${jobId} (type=${type}, attempt=${retryCount + 1}/${maxRetries + 1})`);

    // Notify API: job assigned
    await this.updateJobStatus(jobId, JobStatus.ASSIGNED, workerId);

    // Small delay then mark running
    await sleep(200);
    await this.updateJobStatus(jobId, JobStatus.RUNNING, workerId);

    try {
      const executor = new JobExecutor(jobId, type, payload, workerId);
      const result = await executor.execute(async (progress: number) => {
        await this.reportProgress(jobId, progress, workerId);
      });

      // Mark completed
      await this.updateJobStatus(jobId, JobStatus.COMPLETED, workerId, {
        progress: 100,
        result,
      });

      logger.info(`Job ${jobId} completed successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`Job ${jobId} failed: ${errorMessage}`);

      const canRetry = retryCount < maxRetries;
      const newStatus = canRetry ? JobStatus.RETRYING : JobStatus.FAILED;

      await this.updateJobStatus(jobId, newStatus, workerId, {
        errorMessage,
      });

      if (canRetry) {
        // API server's scheduler will re-enqueue
        logger.info(`Job ${jobId} will be retried (${retryCount + 1}/${maxRetries})`);
      }

      // Still throw so BullMQ marks the job as failed in its own state
      throw err;
    }
  }

  private async updateJobStatus(
    jobId: string,
    status: JobStatus,
    workerId: string,
    extra: { progress?: number; result?: unknown; errorMessage?: string } = {}
  ): Promise<void> {
    try {
      await axios.patch(`${API_BASE}/api/jobs/${jobId}/status`, {
        status,
        workerId,
        ...extra,
      });
    } catch (err) {
      logger.error(`Failed to update job ${jobId} status to ${status}:`, err);
    }
  }

  private async reportProgress(jobId: string, progress: number, workerId: string): Promise<void> {
    try {
      await axios.patch(`${API_BASE}/api/jobs/${jobId}/progress`, {
        progress,
        workerId,
      });
    } catch (err) {
      logger.debug(`Failed to report progress for job ${jobId}:`, err);
    }
  }

  async shutdown(): Promise<void> {
    logger.info(`Shutting down worker ${this.workerName}...`);

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer as NodeJS.Timeout);
    }

    if (this.bullWorker) {
      await this.bullWorker.close();
    }

    logger.info('Worker shutdown complete');
  }
}
