import { fetchJobs } from '@/lib/api';
import { JobsClient } from './JobsClient';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  const jobs = await fetchJobs({ pageSize: 25 }).catch(() => null);
  return <JobsClient initialData={jobs} />;
}
