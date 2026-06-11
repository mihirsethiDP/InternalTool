import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, LogOut, ChevronDown, Globe } from 'lucide-react';
import type { Profile } from '../lib/types';
import { LANGUAGES, setLanguage } from '../i18n';

interface Props {
  profile: Profile | null;
  email: string | null;
  onSignOut: () => void;
}

export default function UserMenu({ profile, email, onSignOut }: Props) {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const display = profile?.full_name || (email || 'User').split('@')[0];
  const initials = display.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md hover:bg-white/10 transition pl-1 pr-1.5 py-1"
        aria-label="Account menu"
      >
        <span className="bg-white text-brand-700 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold">
          {initials}
        </span>
        <ChevronDown size={14} className="text-white/70" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white text-slate-900 shadow-xl border border-slate-200 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="text-sm font-semibold text-slate-900 truncate">{display}</div>
            <div className="text-xs text-slate-500 truncate">{email}</div>
            {profile?.role && (
              <div className="mt-1.5"><span className="badge-blue text-[10px]">{profile.role.toUpperCase()}</span></div>
            )}
          </div>
          <button
            onClick={() => { setOpen(false); nav('/profile'); }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
          >
            <User size={15} strokeWidth={2} />
            {t('nav.editProfile')}
          </button>
          <div className="px-4 py-2.5 border-t border-slate-100">
            <div className="flex items-center gap-2 text-sm text-slate-700 mb-1.5">
              <Globe size={15} strokeWidth={2} />
              {t('nav.language')}
            </div>
            <select
              value={i18n.language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white text-slate-900 px-2 py-1.5 text-sm focus:border-brand-700 outline-none"
            >
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native}</option>)}
            </select>
          </div>
          <button
            onClick={() => { setOpen(false); onSignOut(); }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition border-t border-slate-100"
          >
            <LogOut size={15} strokeWidth={2} />
            {t('nav.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}
