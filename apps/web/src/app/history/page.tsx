import { fetchHistory } from '@/lib/api';
import { HistoryClient } from './HistoryClient';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const history = await fetchHistory({ pageSize: 25 }).catch(() => null);
  return <HistoryClient initialData={history} />;
}
