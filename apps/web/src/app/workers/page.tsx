import { fetchWorkers } from '@/lib/api';
import { WorkersClient } from './WorkersClient';

export const dynamic = 'force-dynamic';

export default async function WorkersPage() {
  const workers = await fetchWorkers().catch(() => null);
  return <WorkersClient initialWorkers={workers} />;
}
