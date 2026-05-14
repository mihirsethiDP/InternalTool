import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth, canUpload, isAdmin } from '../lib/auth';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition ${
    isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
  }`;

export default function Layout() {
  const { profile, email } = useAuth();
  const nav = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    nav('/login');
  }

  const initials = (email || 'U').split('@')[0].slice(0, 2).toUpperCase();

  return (
    <div className="min-h-full flex flex-col bg-slate-50">
      {/* Header — solid brand, white text, user pill on right */}
      <header className="bg-brand-700 text-white">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center gap-6">
          <NavLink to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <span className="bg-white/15 rounded-lg w-9 h-9 flex items-center justify-center text-base">💧</span>
            <span>Digital Paani</span>
            <span className="text-white/60 font-normal hidden sm:inline">· Docs</span>
          </NavLink>
          <nav className="flex items-center gap-1 ml-2">
            <NavLink to="/" end className={navCls}>Search</NavLink>
            <NavLink to="/browse" className={navCls}>Browse</NavLink>
            <NavLink to="/plants" className={navCls}>Plants</NavLink>
            <NavLink to="/sensors" className={navCls}>Sensors</NavLink>
            {canUpload(profile) && <NavLink to="/upload" className={navCls}>Upload</NavLink>}
            {isAdmin(profile) && <NavLink to="/admin" className={navCls}>Admin</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2.5 bg-white/10 hover:bg-white/15 transition rounded-full pl-2 pr-3 py-1">
              <span className="bg-white text-brand-700 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold">
                {initials}
              </span>
              <div className="leading-tight">
                <div className="text-xs font-medium">{email}</div>
                {profile?.role && (
                  <div className="text-[10px] uppercase tracking-wide text-white/70">{profile.role}</div>
                )}
              </div>
            </div>
            <button onClick={signOut} className="text-sm text-white/80 hover:text-white px-2 py-1">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-5 py-8"><Outlet /></div>
      </main>

      <footer className="border-t border-slate-200 bg-white text-xs text-slate-500 py-4 text-center">
        Digital Paani · Internal Document Hub
      </footer>
    </div>
  );
}
