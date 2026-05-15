import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Browse from './pages/Browse';
import PlantList from './pages/PlantList';
import PlantDetail from './pages/PlantDetail';
import SensorModelList from './pages/SensorModelList';
import SensorModelDetail from './pages/SensorModelDetail';
import Admin from './pages/Admin';
import Login from './pages/Login';
import { useAuth } from './lib/auth';

function Protected({ children }: { children: JSX.Element }) {
  const { loading, userId } = useAuth();
  if (loading) return <div className="p-8 text-slate-500">Loading…</div>;
  if (!userId) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<Home />} />
        <Route path="browse" element={<Browse />} />
        <Route path="plants" element={<PlantList />} />
        <Route path="plants/:id" element={<PlantDetail />} />
        <Route path="sensors" element={<SensorModelList />} />
        <Route path="sensors/:id" element={<SensorModelDetail />} />
        <Route path="upload" element={<Navigate to="/" replace />} />
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<div className="p-6">Not found.</div>} />
      </Route>
    </Routes>
  );
}
