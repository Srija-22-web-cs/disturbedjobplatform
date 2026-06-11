import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-6xl font-bold text-gray-800 mb-4">404</p>
      <h2 className="text-lg font-semibold text-gray-300 mb-2">Page not found</h2>
      <p className="text-gray-600 text-sm mb-6">The page you're looking for doesn't exist.</p>
      <Link href="/" className="btn-primary">
        Go to Dashboard
      </Link>
    </div>
  );
}
