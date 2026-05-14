import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth, canUpload, isAdmin } from '../lib/auth';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm font-medium ${
    isActive ? 'bg-brand-700 text-white' : 'text-slate-700 hover:bg-slate-100'
  }`;

export default function Layout() {
  const { profile, email } = useAuth();
  const nav = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    nav('/login');
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <NavLink to="/" className="font-bold text-brand-700 text-lg">📘 DP Docs</NavLink>
          <nav className="flex items-center gap-1 ml-4">
            <NavLink to="/" end className={navCls}>Search</NavLink>
            <NavLink to="/browse" className={navCls}>Browse</NavLink>
            <NavLink to="/plants" className={navCls}>Plants</NavLink>
            <NavLink to="/sensors" className={navCls}>Sensors</NavLink>
            {canUpload(profile) && <NavLink to="/upload" className={navCls}>Upload</NavLink>}
            {isAdmin(profile) && <NavLink to="/admin" className={navCls}>Admin</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-slate-600">{email}</span>
            {profile?.role && <span className="badge-blue">{profile.role}</span>}
            <button onClick={signOut} className="btn-ghost">Sign out</button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-6"><Outlet /></div>
      </main>
      <footer className="border-t border-slate-200 bg-white text-xs text-slate-500 py-3 text-center">
        Digital Paani · Internal Document Hub
      </footer>
    </div>
  );
}
