import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, ChevronDown, Check, X, Search } from 'lucide-react';
import { usePlant } from '../lib/plant';

// "Where are you?" — lives in the header so the answer travels with every
// question. Picking a plant is what lets the assistant skip "which make &
// model?"; clearing it returns the tool to the plant-agnostic behaviour.
export default function PlantSwitcher({ variant = 'header' }: { variant?: 'header' | 'menu' | 'light' }) {
  const { t } = useTranslation();
  const { plants, plant, setPlant, loading } = usePlant();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The 'light' variant lives inside scroll containers (the chat drawer), so
  // its menu is fixed-positioned and clamped to the viewport instead of
  // hanging off whichever edge the button happens to be near.
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | undefined>(undefined);

  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    // preventScroll: inside the chat drawer a plain focus() scrolled the
    // message list sideways to bring the search box into view.
    if (open) { document.addEventListener('mousedown', onClick); document.addEventListener('keydown', onKey); setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0); }
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  useEffect(() => {
    if (!open || variant !== 'light' || !btnRef.current) { setMenuStyle(undefined); return; }
    const place = () => {
      const r = btnRef.current!.getBoundingClientRect();
      const width = Math.min(352, window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
      const below = window.innerHeight - r.bottom - 12;
      setMenuStyle({ position: 'fixed', top: r.bottom + 6, left, width, maxHeight: Math.max(220, Math.min(380, below)) });
    };
    place();
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, variant]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = n ? plants.filter((p) => p.name.toLowerCase().includes(n) || (p.code ?? '').toLowerCase().includes(n) || (p.client ?? '').toLowerCase().includes(n)) : plants;
    return list.slice(0, 60);
  }, [plants, q]);

  if (loading && plants.length === 0) return null;
  if (plants.length === 0) return null; // register not imported yet — nothing to pick

  const label = plant ? (plant.code ? `${plant.name}` : plant.name) : t('home.pickPlant');
  const btnCls = variant === 'header'
    ? `tap inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition max-w-[46vw] sm:max-w-[16rem] ${plant ? 'bg-white/15 text-white hover:bg-white/20' : 'text-white/80 hover:text-white hover:bg-white/10 border border-dashed border-white/30'}`
    : variant === 'light'
      ? 'tap inline-flex items-center gap-1.5 rounded-lg border border-brand-700 bg-white text-brand-700 hover:bg-brand-50 px-3.5 py-2 text-sm font-semibold transition'
      : 'tap flex w-full items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-white/90 hover:bg-white/10 transition';

  return (
    <div ref={ref} className="relative">
      <button ref={btnRef} onClick={() => setOpen((o) => !o)} className={btnCls} aria-haspopup="listbox" aria-expanded={open} aria-label={plant ? `Plant: ${plant.name}` : t('home.pickPlant')}>
        <MapPin size={15} strokeWidth={2.25} className="shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown size={13} className="shrink-0 opacity-70" />
      </button>

      {open && (
        <div style={menuStyle} className={`${menuStyle ? 'flex flex-col' : `absolute ${variant === 'header' ? 'right-0 sm:left-0 sm:right-auto' : 'left-0'} mt-2 w-[min(92vw,22rem)]`} rounded-xl bg-white text-slate-900 shadow-xl border border-slate-200 overflow-hidden z-50`}>
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search plant, client or code…"
                className="w-full rounded-md border border-slate-200 pl-8 pr-2 py-1.5 text-sm outline-none focus:border-brand-700"
                aria-label="Search plants"
              />
            </div>
          </div>
          <ul role="listbox" className={`${menuStyle ? 'flex-1 min-h-0' : 'max-h-72'} overflow-y-auto scrollbar-thin py-1`}>
            {plant && (
              <li>
                <button onClick={() => { setPlant(null); setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  <X size={14} /> No plant — answer generally
                </button>
              </li>
            )}
            {filtered.map((p) => {
              const active = p.id === plant?.id;
              return (
                <li key={p.id}>
                  <button
                    role="option"
                    aria-selected={active}
                    onClick={() => { setPlant(p.id); setOpen(false); setQ(''); }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-brand-50 ${active ? 'bg-brand-50 text-brand-800' : 'text-slate-800'}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-[11px] text-slate-500">{[p.client, p.code].filter(Boolean).join(' · ')}</span>
                    </span>
                    {active && <Check size={14} className="text-brand-700 shrink-0" />}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">No plant matches “{q}”.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
