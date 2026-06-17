import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, MessageSquare, Menu, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, canUpload, isAdmin } from '../lib/auth';
import { UploadProvider, useUpload } from './UploadModal';
import NotificationBell from './NotificationBell';
import ChatDrawer from './ChatDrawer';
import UserMenu from './UserMenu';
import AccessibilityMenu from './AccessibilityMenu';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition ${
    isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:text-white hover:bg-white/10'
  }`;

const mobileNavCls = ({ isActive }: { isActive: boolean }) =>
  `tap flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition ${
    isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
  }`;

function Inner() {
  const { profile, email } = useAuth();
  const nav = useNavigate();
  const { t } = useTranslation();
  const upload = useUpload();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSeed, setChatSeed] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
        <div className="max-w-7xl mx-auto px-4 sm:px-5 h-16 flex items-center gap-3 md:gap-6">
          <NavLink to="/" className="flex items-center shrink-0" aria-label="DigitalPaani — home">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="DigitalPaani"
              className="h-9 w-auto object-contain"
              onError={(e) => { (e.currentTarget.style.display = 'none'); }}
            />
          </NavLink>
          <div className="hidden md:block w-px h-6 bg-white/15" />
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/" end className={navCls}>{t('nav.search')}</NavLink>
            <NavLink to="/browse" className={navCls}>{t('nav.browse')}</NavLink>
            <NavLink to="/sensors" className={navCls}>{t('nav.sensors')}</NavLink>
            {canUpload(profile) && !isAdmin(profile) && <NavLink to="/my-submissions" className={navCls}>{t('nav.uploads')}</NavLink>}
            {isAdmin(profile) && <NavLink to="/admin" className={navCls}>{t('nav.admin')}</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {canUpload(profile) && (
              <button
                onClick={() => upload.open()}
                aria-label={t('nav.upload')}
                className="tap inline-flex items-center gap-1.5 bg-white text-brand-700 hover:bg-slate-100 transition rounded-md px-2.5 sm:px-3 py-1.5 text-sm font-medium"
              >
                <Plus size={16} strokeWidth={2.25} />
                <span className="hidden sm:inline">{t('nav.upload')}</span>
              </button>
            )}
            <AccessibilityMenu />
            <NotificationBell />
            <UserMenu profile={profile} email={email} onSignOut={signOut} />
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              className="tap md:hidden rounded-md w-9 h-9 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {/* Mobile nav drawer */}
        {menuOpen && (
          <nav className="md:hidden border-t border-white/10 bg-brand-800 px-4 py-2 flex flex-col gap-1" aria-label="Main">
            <NavLink to="/" end onClick={() => setMenuOpen(false)} className={mobileNavCls}>{t('nav.search')}</NavLink>
            <NavLink to="/browse" onClick={() => setMenuOpen(false)} className={mobileNavCls}>{t('nav.browse')}</NavLink>
            <NavLink to="/sensors" onClick={() => setMenuOpen(false)} className={mobileNavCls}>{t('nav.sensors')}</NavLink>
            {canUpload(profile) && !isAdmin(profile) && <NavLink to="/my-submissions" onClick={() => setMenuOpen(false)} className={mobileNavCls}>{t('nav.uploads')}</NavLink>}
            {isAdmin(profile) && <NavLink to="/admin" onClick={() => setMenuOpen(false)} className={mobileNavCls}>{t('nav.admin')}</NavLink>}
          </nav>
        )}
      </header>

      <main className="flex-1"><div className="max-w-7xl mx-auto px-4 sm:px-5 py-6 sm:py-8"><Outlet /></div></main>

      <footer className="border-t border-slate-200 bg-white text-xs text-slate-500 py-4 text-center">
        DigitalPaani · Internal Document Hub
        <span className="mx-2 text-slate-300">·</span>
        <NavLink to="/privacy" className="hover:text-brand-700 hover:underline">Privacy</NavLink>
      </footer>

      {/* Floating chat launcher — primary action of the tool, made prominent */}
      <button
        onClick={() => setChatOpen(true)}
        aria-label="Open assistant"
        className="group fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 inline-flex items-center gap-2.5 bg-gradient-to-br from-brand-600 to-brand-800 hover:from-brand-700 hover:to-brand-900 text-white rounded-full pl-4 pr-5 py-3.5 shadow-lg hover:shadow-xl transition"
      >
        <span className="relative flex">
          <MessageSquare size={20} strokeWidth={2} />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-brand-800 animate-pulse" />
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
