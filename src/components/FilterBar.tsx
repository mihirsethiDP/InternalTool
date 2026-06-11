import { ReactNode } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

/**
 * Single-row filter toolbar used across list pages (Sensors, Browse).
 * Law of similarity: same height, radius, and focus treatment for every
 * control; selects are pill-shaped with an inline chevron; the clear
 * action appears only when something is active.
 */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center gap-2 flex-wrap">
      {children}
    </div>
  );
}

export function FilterSearch({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex-1 min-w-52">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 focus:bg-white pl-9 pr-3 py-2 text-sm focus:border-brand-700 focus:ring-2 focus:ring-brand-700/15 outline-none transition"
      />
    </div>
  );
}

export function FilterSelect({ value, onChange, disabled, children, active }: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: ReactNode;        // <option> elements
  active?: boolean;           // value !== '' → tinted
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`appearance-none rounded-lg border pl-3 pr-8 py-2 text-sm outline-none transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          active
            ? 'border-brand-700 bg-brand-50 text-brand-900 font-medium'
            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 focus:border-brand-700'
        }`}
      >
        {children}
      </select>
      <ChevronDown size={14} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${active ? 'text-brand-700' : 'text-slate-400'}`} />
    </div>
  );
}

export function FilterClear({ onClick, label = 'Clear' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
    >
      <X size={13} /> {label}
    </button>
  );
}
