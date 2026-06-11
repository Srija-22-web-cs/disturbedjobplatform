import 'dotenv/config';
import prisma from './lib/prisma';
import { JobStatus, WorkerStatus, JobPriority } from '@distributed-job-platform/shared-types';

async function seed() {
  console.log('Seeding database...');

  // Create sample workers
  const workers = await Promise.all([
    prisma.worker.upsert({
      where: { name: 'worker-demo-alpha' },
      update: {},
      create: {
        name: 'worker-demo-alpha',
        status: WorkerStatus.ONLINE,
        lastHeartbeat: new Date(),
      },
    }),
    prisma.worker.upsert({
      where: { name: 'worker-demo-beta' },
      update: {},
      create: {
        name: 'worker-demo-beta',
        status: WorkerStatus.OFFLINE,
        lastHeartbeat: new Date(Date.now() - 120_000),
      },
    }),
  ]);

  // Create sample jobs
  const jobTypes = ['data-processing', 'image-resize', 'report-generation', 'email-send', 'ml-inference'];
  const statuses = [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.QUEUED];

  for (let i = 0; i < 15; i++) {
    const status = statuses[i % statuses.length];
    const job = await prisma.job.create({
      data: {
        type: jobTypes[i % jobTypes.length],
        payload: { batchId: `batch-${i}`, items: Math.floor(Math.random() * 100) + 1 },
        priority: (i % 3) + 1,
        status,
        progress: status === JobStatus.COMPLETED ? 100 : status === JobStatus.FAILED ? Math.floor(Math.random() * 80) : 0,
        retryCount: status === JobStatus.FAILED ? 1 : 0,
        maxRetries: 3,
        assignedWorkerId: status !== JobStatus.QUEUED ? workers[0].id : null,
        result: status === JobStatus.COMPLETED ? { processed: 42, duration: 8500 } : null,
        errorMessage: status === JobStatus.FAILED ? 'Simulated processing error' : null,
      },
    });

    if (status !== JobStatus.QUEUED) {
      await prisma.executionHistory.create({
        data: {
          jobId: job.id,
          workerId: workers[0].id,
          status,
          logs: [
            `[${new Date().toISOString()}] Job started`,
            `[${new Date().toISOString()}] Processing...`,
            status === JobStatus.COMPLETED
              ? `[${new Date().toISOString()}] Job completed successfully`
              : `[${new Date().toISOString()}] Error: Simulated failure`,
          ],
          startedAt: new Date(Date.now() - 30_000),
          completedAt: new Date(),
        },
      });
    }
  }

  console.log(`Seeded ${workers.length} workers and 15 jobs`);
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
