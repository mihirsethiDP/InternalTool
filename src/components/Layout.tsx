import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, canUpload, isAdmin } from '../lib/auth';
import { UploadProvider, useUpload } from './UploadModal';
import NotificationBell from './NotificationBell';
import ChatDrawer from './ChatDrawer';
import UserMenu from './UserMenu';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition ${
    isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:text-white hover:bg-white/10'
  }`;

function Inner() {
  const { profile, email } = useAuth();
  const nav = useNavigate();
  const { t } = useTranslation();
  const upload = useUpload();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSeed, setChatSeed] = useState<string | null>(null);

  // Anywhere in the app can open the assistant via:
  //   window.dispatchEvent(new CustomEvent('dp:open-chat', { detail: { q: 'optional question' } }))
  useEffect(() => {
    function onOpenChat(e: Event) {
      const detail = (e as CustomEvent).detail;
      setChatSeed(detail?.q ?? null);
      setChatOpen(true);
    }
    window.addEventListener('dp:open-chat', onOpenChat);
    return () => window.removeEventListener('dp:open-chat', onOpenChat);
  }, []);

  async function signOut() { await supabase.auth.signOut(); nav('/login'); }

  return (
    <div className="min-h-full flex flex-col bg-slate-50">
      <header className="bg-brand-700 text-white">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center gap-6">
          <NavLink to="/" className="flex items-center shrink-0" aria-label="DigitalPaani — home">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="DigitalPaani"
              className="h-9 w-auto object-contain"
              onError={(e) => { (e.currentTarget.style.display = 'none'); }}
            />
          </NavLink>
          <div className="w-px h-6 bg-white/15" />
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navCls}>{t('nav.search')}</NavLink>
            <NavLink to="/browse" className={navCls}>{t('nav.browse')}</NavLink>
            <NavLink to="/sensors" className={navCls}>{t('nav.sensors')}</NavLink>
            {canUpload(profile) && !isAdmin(profile) && <NavLink to="/my-submissions" className={navCls}>{t('nav.uploads')}</NavLink>}
            {isAdmin(profile) && <NavLink to="/admin" className={navCls}>{t('nav.admin')}</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {canUpload(profile) && (
              <button
                onClick={() => upload.open()}
                className="inline-flex items-center gap-1.5 bg-white text-brand-700 hover:bg-slate-100 transition rounded-md px-3 py-1.5 text-sm font-medium"
              >
                <Plus size={16} strokeWidth={2.25} />
                {t('nav.upload')}
              </button>
            )}
            <NotificationBell />
            <UserMenu profile={profile} email={email} onSignOut={signOut} />
          </div>
        </div>
      </header>

      <main className="flex-1"><div className="max-w-7xl mx-auto px-5 py-8"><Outlet /></div></main>

      <footer className="border-t border-slate-200 bg-white text-xs text-slate-500 py-4 text-center">
        DigitalPaani · Internal Document Hub
      </footer>

      {/* Floating chat launcher — primary action of the tool, made prominent */}
      <button
        onClick={() => setChatOpen(true)}
        aria-label="Open assistant"
        className="group fixed bottom-6 right-6 z-40 inline-flex items-center gap-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-full pl-4 pr-5 py-3.5 shadow-lg hover:shadow-xl transition"
      >
        <span className="relative flex">
          <MessageSquare size={20} strokeWidth={2} />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-brand-700 animate-pulse" />
        </span>
        <span className="text-sm font-semibold tracking-tight">{t('chat.launcher')}</span>
      </button>

      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        seed={chatSeed}
        onSeedConsumed={() => setChatSeed(null)}
      />
    </div>
  );
}

export default function Layout() {
  return <UploadProvider><Inner /></UploadProvider>;
}
