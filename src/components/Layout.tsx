import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Plus, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, canUpload, isAdmin } from '../lib/auth';
import { UploadProvider, useUpload } from './UploadModal';
import NotificationBell from './NotificationBell';
import ChatDrawer from './ChatDrawer';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition ${
    isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:text-white hover:bg-white/10'
  }`;

function Inner() {
  const { profile, email } = useAuth();
  const nav = useNavigate();
  const upload = useUpload();
  const [chatOpen, setChatOpen] = useState(false);

  async function signOut() { await supabase.auth.signOut(); nav('/login'); }
  const initials = (email || 'U').split('@')[0].slice(0, 2).toUpperCase();

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
            <NavLink to="/" end className={navCls}>Search</NavLink>
            <NavLink to="/browse" className={navCls}>Browse</NavLink>
            <NavLink to="/sensors" className={navCls}>Sensors</NavLink>
            {canUpload(profile) && !isAdmin(profile) && <NavLink to="/my-submissions" className={navCls}>Uploads</NavLink>}
            {isAdmin(profile) && <NavLink to="/admin" className={navCls}>Admin</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {canUpload(profile) && (
              <button
                onClick={() => upload.open()}
                className="inline-flex items-center gap-1.5 bg-white text-brand-700 hover:bg-slate-100 transition rounded-md px-3 py-1.5 text-sm font-medium"
              >
                <Plus size={16} strokeWidth={2.25} />
                Upload
              </button>
            )}
            <NotificationBell />
            <div className="w-px h-6 bg-white/15 mx-1" />
            <div className="hidden md:flex items-center gap-2.5 pl-1 pr-2">
              <span className="bg-white text-brand-700 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold tracking-tight">
                {initials}
              </span>
              <div className="leading-tight">
                <div className="text-xs font-medium">{email}</div>
                {profile?.role && (
                  <div className="text-[10px] uppercase tracking-wider text-white/60">{profile.role}</div>
                )}
              </div>
            </div>
            <button onClick={signOut} className="text-sm text-white/70 hover:text-white px-2 py-1">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1"><div className="max-w-7xl mx-auto px-5 py-8"><Outlet /></div></main>

      <footer className="border-t border-slate-200 bg-white text-xs text-slate-500 py-4 text-center">
        DigitalPaani · Internal Document Hub
      </footer>

      {/* Floating chat launcher */}
      <button
        onClick={() => setChatOpen(true)}
        aria-label="Open assistant"
        className="fixed bottom-6 right-6 z-40 bg-brand-700 text-white rounded-full w-12 h-12 shadow-md hover:shadow-lg hover:bg-brand-800 transition flex items-center justify-center"
      >
        <MessageSquare size={20} strokeWidth={2} />
      </button>

      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}

export default function Layout() {
  return <UploadProvider><Inner /></UploadProvider>;
}
