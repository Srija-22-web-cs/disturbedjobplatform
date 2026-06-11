import clsx from 'clsx';
import { JobStatus, JobPriority, WorkerStatus } from '@distributed-job-platform/shared-types';

// Status Badge
const JOB_STATUS_STYLES: Record<JobStatus, string> = {
  [JobStatus.QUEUED]: 'bg-blue-900/50 text-blue-300 border border-blue-800/50',
  [JobStatus.ASSIGNED]: 'bg-purple-900/50 text-purple-300 border border-purple-800/50',
  [JobStatus.RUNNING]: 'bg-yellow-900/50 text-yellow-300 border border-yellow-800/50',
  [JobStatus.COMPLETED]: 'bg-emerald-900/50 text-emerald-300 border border-emerald-800/50',
  [JobStatus.FAILED]: 'bg-red-900/50 text-red-300 border border-red-800/50',
  [JobStatus.RETRYING]: 'bg-orange-900/50 text-orange-300 border border-orange-800/50',
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={clsx('badge', JOB_STATUS_STYLES[status])}>
      {status === JobStatus.RUNNING && (
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
      )}
      {status}
    </span>
  );
}

const PRIORITY_STYLES: Record<number, string> = {
  [JobPriority.HIGH]: 'bg-red-900/40 text-red-300 border border-red-800/40',
  [JobPriority.MEDIUM]: 'bg-amber-900/40 text-amber-300 border border-amber-800/40',
  [JobPriority.LOW]: 'bg-gray-800 text-gray-400 border border-gray-700',
};

const PRIORITY_LABELS: Record<number, string> = {
  [JobPriority.HIGH]: 'High',
  [JobPriority.MEDIUM]: 'Medium',
  [JobPriority.LOW]: 'Low',
};

export function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span className={clsx('badge', PRIORITY_STYLES[priority] || PRIORITY_STYLES[JobPriority.MEDIUM])}>
      {PRIORITY_LABELS[priority] || 'Medium'}
    </span>
  );
}

export function WorkerStatusBadge({ status }: { status: WorkerStatus }) {
  return (
    <span
      className={clsx(
        'badge',
        status === WorkerStatus.ONLINE
          ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-800/50'
          : 'bg-gray-800 text-gray-500 border border-gray-700'
      )}
    >
      {status === WorkerStatus.ONLINE && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      )}
      {status}
    </span>
  );
}

// Progress Bar
export function ProgressBar({ value, status }: { value: number; status?: JobStatus }) {
  const color =
    status === JobStatus.FAILED
      ? 'bg-red-500'
      : status === JobStatus.COMPLETED
      ? 'bg-emerald-500'
      : status === JobStatus.RUNNING
      ? 'bg-brand-500'
      : 'bg-gray-600';

  return (
    <div className="progress-bar w-full min-w-[80px]">
      <div
        className={clsx('progress-fill', color)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

// Stat Card
export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange' | 'default';
}) {
  const accentMap = {
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    default: 'text-white',
  };
  const textColor = accentMap[accent || 'default'];

  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={clsx('text-3xl font-bold', textColor)}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

// Empty state
export function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center mb-4">
        <span className="text-2xl">🕳️</span>
      </div>
      <p className="text-gray-300 font-medium">{message}</p>
      {sub && <p className="text-gray-600 text-sm mt-1">{sub}</p>}
    </div>
  );
}

// Spinner
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }[size];
  return (
    <div
      className={clsx(
        s,
        'border-2 border-gray-700 border-t-brand-500 rounded-full animate-spin'
      )}
    />
  );
}

// Loading skeleton
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('bg-gray-800 rounded animate-pulse', className)} />;
}

// Truncated ID
export function ShortId({ id }: { id: string }) {
  return (
    <span className="font-mono text-xs text-gray-400" title={id}>
      {id.slice(0, 8)}…
    </span>
  );
}

// Relative time (client only)
export function RelativeTime({ date }: { date: string | Date }) {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);

  let label: string;
  if (s < 10) label = 'just now';
  else if (s < 60) label = `${s}s ago`;
  else if (m < 60) label = `${m}m ago`;
  else if (h < 24) label = `${h}h ago`;
  else label = d.toLocaleDateString();

  return (
    <time dateTime={d.toISOString()} title={d.toLocaleString()} className="text-gray-500 text-xs">
      {label}
    </time>
  );
}

// Error box
export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="card border-red-900/50 bg-red-950/20 p-4 text-sm text-red-400">
      ⚠ {message}
    </div>
  );
}
