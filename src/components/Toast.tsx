import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

// Auto-dismissing confirmations.
//
// Deliberately requires no click: the operator's hands are often busy, and a
// toast that must be dismissed is just another thing in the way. It announces
// itself to screen readers, then disappears on its own.

type ToastKind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: ToastKind; text: string }

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}
const ToastCtx = createContext<ToastApi | null>(null);

/** Safe to call anywhere — a component outside the provider simply no-ops. */
export function useToast(): ToastApi {
  return useContext(ToastCtx) ?? { success: () => {}, error: () => {}, info: () => {} };
}

const LIFETIME: Record<ToastKind, number> = {
  success: 3500,
  info: 4000,
  error: 7000, // errors get longer — they usually need reading, not just noticing
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-2), { id, kind, text }]); // at most 3 on screen
    const t = window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), LIFETIME[kind]);
    timers.current.push(t);
  }, []);

  useEffect(() => () => { for (const t of timers.current) clearTimeout(t); }, []);

  const api: ToastApi = {
    success: useCallback((t: string) => push('success', t), [push]),
    error: useCallback((t: string) => push('error', t), [push]),
    info: useCallback((t: string) => push('info', t), [push]),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {/* Bottom-left: the chat launcher owns the bottom-right corner. */}
      <div className="fixed bottom-5 left-5 z-[60] flex flex-col gap-2 pointer-events-none max-w-[min(24rem,calc(100vw-2.5rem))]">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={`dp-toast pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-lg text-sm ${
              t.kind === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : t.kind === 'error' ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <span className="shrink-0 mt-0.5">
              {t.kind === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" />
                : t.kind === 'error' ? <AlertTriangle size={16} className="text-red-600" />
                : <Info size={16} className="text-slate-500" />}
            </span>
            <span className="min-w-0 flex-1 leading-snug">{t.text}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Dismiss"
              className="tap shrink-0 opacity-40 hover:opacity-80 transition -mr-0.5 -mt-0.5"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes dpToastIn { from { transform: translateY(8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .dp-toast { animation: dpToastIn .18s ease-out }
        @media (prefers-reduced-motion: reduce) { .dp-toast { animation: none } }
      `}</style>
    </ToastCtx.Provider>
  );
}
