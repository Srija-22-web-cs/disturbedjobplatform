import { fetchJobStats, fetchJobs, fetchWorkers } from '@/lib/api';
import { DashboardClient } from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [stats, jobs, workers] = await Promise.all([
    fetchJobStats().catch(() => null),
    fetchJobs({ pageSize: 5 }).catch(() => null),
    fetchWorkers().catch(() => null),
  ]);

  return <DashboardClient initialStats={stats} initialJobs={jobs} initialWorkers={workers} />;
}
