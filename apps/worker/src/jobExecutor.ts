import { sleep } from '@distributed-job-platform/shared-utils';
import logger from './logger';

type ProgressCallback = (progress: number) => Promise<void>;

export class JobExecutor {
  private jobId: string;
  private type: string;
  private payload: Record<string, unknown>;
  private workerId: string;

  constructor(
    jobId: string,
    type: string,
    payload: Record<string, unknown>,
    workerId: string
  ) {
    this.jobId = jobId;
    this.type = type;
    this.payload = payload;
    this.workerId = workerId;
  }

  async execute(onProgress: ProgressCallback): Promise<Record<string, unknown>> {
    // Execution time between 5-20 seconds
    const totalDuration = 5000 + Math.random() * 15000;
    const startTime = Date.now();

    logger.info(
      `[${this.workerId}] Executing job ${this.jobId} (type=${this.type}, duration=${Math.round(totalDuration / 1000)}s)`
    );

    // Update progress every ~1 second
    const progressInterval = 1000;
    let currentProgress = 0;

    // Determine failure point (20% chance of failure at a random progress %)
    const willFail = Math.random() < 0.2;
    const failAtProgress = willFail ? Math.floor(10 + Math.random() * 70) : null;

    while (currentProgress < 100) {
      await sleep(progressInterval);

      const elapsed = Date.now() - startTime;
      currentProgress = Math.min(99, Math.round((elapsed / totalDuration) * 100));

      // Check if we should fail at this progress point
      if (failAtProgress !== null && currentProgress >= failAtProgress) {
        await onProgress(currentProgress);
        throw new Error(
          `Job execution failed at ${currentProgress}% — ${this.getFailureReason(this.type)}`
        );
      }

      await onProgress(currentProgress);

      if (elapsed >= totalDuration) break;
    }

    // Final progress = 100
    await onProgress(100);

    return this.buildResult(totalDuration);
  }

  private buildResult(durationMs: number): Record<string, unknown> {
    const typeResults: Record<string, Record<string, unknown>> = {
      'data-processing': {
        recordsProcessed: Math.floor(Math.random() * 10000) + 100,
        errors: 0,
        outputFile: `output-${this.jobId}.csv`,
      },
      'image-resize': {
        originalSize: '4096x3072',
        outputSize: '800x600',
        format: 'webp',
        compressionRatio: 0.12,
      },
      'report-generation': {
        pages: Math.floor(Math.random() * 20) + 5,
        charts: Math.floor(Math.random() * 10) + 1,
        format: 'pdf',
        url: `https://reports.example.com/${this.jobId}.pdf`,
      },
      'email-send': {
        recipients: Math.floor(Math.random() * 500) + 1,
        delivered: Math.floor(Math.random() * 500) + 1,
        bounced: 0,
      },
      'ml-inference': {
        predictions: Math.floor(Math.random() * 1000) + 10,
        accuracy: 0.94 + Math.random() * 0.05,
        modelVersion: 'v2.3.1',
      },
    };

    return {
      ...(typeResults[this.type] || { processed: true }),
      durationMs: Math.round(durationMs),
      workerId: this.workerId,
      completedAt: new Date().toISOString(),
    };
  }

  private getFailureReason(type: string): string {
    const reasons: Record<string, string[]> = {
      'data-processing': ['Malformed input record at row 4821', 'Database connection timeout'],
      'image-resize': ['Corrupted image header', 'Unsupported color profile'],
      'report-generation': ['Template rendering error', 'Missing data source'],
      'email-send': ['SMTP connection refused', 'Rate limit exceeded'],
      'ml-inference': ['Model version mismatch', 'GPU memory exceeded'],
    };
    const msgs = reasons[type] || ['Internal processing error', 'Unexpected exception'];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }
}
