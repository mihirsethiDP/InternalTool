import { ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  icon?: ReactNode;
  /** tint for the count pill when this segment is active */
  tone?: 'amber' | 'emerald' | 'red' | 'slate';
}

const TONE_ACTIVE: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-200 text-slate-700',
};

/**
 * iOS-style segmented control with optional per-segment counts.
 * Active segment is a raised white pill inside a recessed track.
 */
export default function SegmentedFilter<T extends string>({ options, value, onChange }: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              active
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {o.icon}
            {o.label}
            {o.count != null && o.count > 0 && (
              <span className={`rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-semibold ${
                active ? TONE_ACTIVE[o.tone ?? 'slate'] : 'bg-slate-200/70 text-slate-500'
              }`}>
                {o.count > 99 ? '99+' : o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
