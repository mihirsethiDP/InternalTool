import { useEffect, useRef, useState } from 'react';
import { Accessibility, Minus, Plus, Contrast, Check } from 'lucide-react';
import { useA11y } from '../lib/accessibility';

// Compact header control for the app-wide accessibility preferences:
// text size (A− / A+) and a high-contrast toggle. Keyboard accessible.
export default function AccessibilityMenu() {
  const { textScale, highContrast, incScale, decScale, toggleContrast } = useA11y();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const scaleLabel = textScale === 'normal' ? 'Default' : textScale === 'large' ? 'Large' : 'Extra large';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Accessibility options"
        title="Accessibility options"
        className="rounded-md w-9 h-9 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition"
      >
        <Accessibility size={19} strokeWidth={2} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Accessibility options"
          className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-xl p-3 z-50 text-slate-800"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Accessibility</div>

          {/* Text size */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-slate-700">Text size</span>
              <span className="text-xs text-slate-500">{scaleLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={decScale}
                disabled={textScale === 'normal'}
                aria-label="Decrease text size"
                className="tap flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white py-2 text-sm hover:border-brand-700 disabled:opacity-40 disabled:hover:border-slate-300 transition"
              >
                <Minus size={14} /> <span className="text-xs">A</span>
              </button>
              <button
                onClick={incScale}
                disabled={textScale === 'xlarge'}
                aria-label="Increase text size"
                className="tap flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white py-2 text-sm hover:border-brand-700 disabled:opacity-40 disabled:hover:border-slate-300 transition"
              >
                <Plus size={14} /> <span className="text-base font-semibold">A</span>
              </button>
            </div>
          </div>

          {/* High contrast */}
          <button
            onClick={toggleContrast}
            role="switch"
            aria-checked={highContrast}
            className="tap w-full inline-flex items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 hover:border-brand-700 transition"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <Contrast size={15} /> High contrast
            </span>
            <span className={`inline-flex items-center justify-center w-9 h-5 rounded-full transition ${highContrast ? 'bg-brand-700' : 'bg-slate-300'}`}>
              <span className={`w-4 h-4 bg-white rounded-full shadow transform transition ${highContrast ? 'translate-x-2' : '-translate-x-2'}`}>
                {highContrast && <Check size={11} className="text-brand-700 m-0.5" />}
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
