'use client';

import { useSocket } from '@/components/providers/SocketProvider';
import clsx from 'clsx';

export function TopBar() {
  const { connected } = useSocket();

  return (
    <header className="h-16 shrink-0 border-b border-gray-800 bg-gray-900 flex items-center justify-end px-6 gap-4">
      <div className="flex items-center gap-2 text-xs">
        <span
          className={clsx(
            'w-2 h-2 rounded-full',
            connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
          )}
        />
        <span className={connected ? 'text-emerald-400' : 'text-red-400'}>
          {connected ? 'Live' : 'Disconnected'}
        </span>
      </div>
    </header>
  );
}
