import { ReactNode } from 'react';

interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: string;
  action?: ReactNode;
  stats?: { label: string; value: number | string }[];
  /** 'gradient' = brand-tinted hero (default). 'subtle' = white card. */
  variant?: 'gradient' | 'subtle';
}

export default function PageHeader({ eyebrow, title, subtitle, icon, action, stats, variant = 'gradient' }: Props) {
  if (variant === 'subtle') {
    return (
      <div className="flex items-end justify-between gap-4 flex-wrap pt-1">
        <div>
          {eyebrow && <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">{eyebrow}</div>}
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{icon && <span className="mr-2">{icon}</span>}{title}</h1>
          {subtitle && <p className="text-slate-500 mt-1.5">{subtitle}</p>}
        </div>
        {action}
      </div>
    );
  }

  return (
    <div className="relative bg-gradient-to-br from-brand-700 via-brand-700 to-brand-900 text-white rounded-2xl p-7 shadow-sm overflow-hidden">
      {/* decorative blobs */}
      <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-brand-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div>
          {eyebrow && <div className="text-xs uppercase tracking-wider text-white/70 mb-1.5">{eyebrow}</div>}
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{icon && <span className="mr-2">{icon}</span>}{title}</h1>
          {subtitle && <p className="text-white/80 mt-2">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      {stats && stats.length > 0 && (
        <div className="relative flex gap-7 mt-6 text-sm">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-bold leading-tight">{s.value}</div>
              <div className="text-xs uppercase tracking-wider text-white/70">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
