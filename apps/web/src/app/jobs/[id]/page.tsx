import { fetchJob } from '@/lib/api';
import { JobDetailClient } from './JobDetailClient';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const job = await fetchJob(params.id).catch(() => null);
  if (!job) notFound();
  return <JobDetailClient job={job} />;
}
