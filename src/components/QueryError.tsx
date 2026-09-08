import { AlertTriangle, RotateCw } from 'lucide-react';

/**
 * Shown when a query FAILED — as opposed to succeeding with nothing to show.
 *
 * The two used to be indistinguishable: every list did `const { data } = await
 * supabase...`, dropped the error, and rendered its empty state. A migration
 * that broke the review queue therefore looked exactly like an empty queue,
 * and nobody could tell the tool was broken. Queries now throw, and this says
 * so out loud.
 */
export default function QueryError({ what, error, onRetry }: {
  what: string;
  error?: unknown;
  onRetry?: () => void;
}) {
  const detail = error instanceof Error ? error.message
    : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message)
    : '';
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
      <AlertTriangle size={17} className="text-red-600 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1 text-sm text-red-900">
        <div className="font-semibold">Couldn’t load {what}.</div>
        <div className="text-xs text-red-800/80 mt-0.5">
          This is a fault, not an empty list — nothing is missing from your data.
          {detail && <span className="block mt-1 font-mono text-[11px] break-words opacity-80">{detail}</span>}
        </div>
      </div>
      {onRetry && (
        <button onClick={onRetry}
          className="tap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 transition">
          <RotateCw size={12} /> Retry
        </button>
      )}
    </div>
  );
}
