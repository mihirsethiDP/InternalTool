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
import Viewer from './pages/Viewer';
import MySubmissions from './pages/MySubmissions';
import { ReviewQueueList, ReviewQueueDetail } from './pages/ReviewQueue';
import ConsolidatedViewer from './pages/ConsolidatedViewer';
import ConsolidatedEditor from './pages/ConsolidatedEditor';
import Profile from './pages/Profile';
import DocsGuide from './pages/DocsGuide';
import Privacy from './pages/Privacy';
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
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<Home />} />
        <Route path="browse" element={<Browse />} />
        <Route path="plants" element={<PlantList />} />
        <Route path="plants/:id" element={<PlantDetail />} />
        <Route path="sensors" element={<SensorModelList />} />
        <Route path="sensors/:id" element={<SensorModelDetail />} />
        <Route path="upload" element={<Navigate to="/" replace />} />
        <Route path="view/:id" element={<Viewer />} />
        <Route path="my-submissions" element={<MySubmissions />} />
        <Route path="review" element={<ReviewQueueList />} />
        <Route path="review/:id" element={<ReviewQueueDetail />} />
        <Route path="consolidated/:id" element={<ConsolidatedViewer />} />
        <Route path="consolidated/:id/edit" element={<ConsolidatedEditor />} />
        <Route path="profile" element={<Profile />} />
        <Route path="docs-guide" element={<DocsGuide />} />
        <Route path="coverage" element={<Navigate to="/sensors?docs=incomplete" replace />} />
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<div className="p-6">Not found.</div>} />
      </Route>
    </Routes>
  );
}
