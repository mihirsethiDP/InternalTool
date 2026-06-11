import { ReactNode } from 'react';

interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Deprecated — emoji icons are no longer rendered in headers. Kept for compatibility. */
  icon?: string;
  action?: ReactNode;
  stats?: { label: string; value: number | string }[];
  /** 'gradient' = brand-tinted hero. 'subtle' = white card. */
  variant?: 'gradient' | 'subtle';
}

export default function PageHeader({ eyebrow, title, subtitle, action, stats, variant = 'gradient' }: Props) {
  if (variant === 'subtle') {
    return (
      <div className="flex items-end justify-between gap-4 flex-wrap pt-1">
        <div>
          {eyebrow && <div className="text-xs uppercase tracking-wider text-slate-500 mb-1.5 font-medium">{eyebrow}</div>}
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="text-slate-500 mt-1.5 text-sm">{subtitle}</p>}
        </div>
        {action}
      </div>
    );
  }

  return (
    <div className="relative bg-brand-700 text-white rounded-xl px-6 py-5 overflow-hidden">
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div>
          {eyebrow && <div className="text-[11px] uppercase tracking-wider text-white/60 mb-1.5 font-medium">{eyebrow}</div>}
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-white/75 mt-2 text-sm max-w-2xl">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {stats && stats.length > 0 && (
        <div className="relative flex gap-8 mt-5 text-sm">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-xl font-semibold leading-tight">{s.value}</div>
              <div className="text-[11px] uppercase tracking-wider text-white/60 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
