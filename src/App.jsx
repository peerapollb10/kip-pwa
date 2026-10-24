import { Navigate, Route, Routes } from 'react-router-dom';
import { useKip } from './context/KipContext.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Share from './pages/Share.jsx';
import Settings from './pages/Settings.jsx';
import Pricing from './pages/Pricing.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Admin from './pages/Admin.jsx';
import Trash from './pages/Trash.jsx';
import Toast from './components/Toast.jsx';
import UpgradeSheet from './components/UpgradeSheet.jsx';
import { Spinner } from './components/ui.jsx';

// Guest Mode: no login wall — the app works immediately with local data.
function Home() {
  const { session, profile } = useKip();
  if (session === undefined || !profile) return <Spinner full />;
  if (!profile.onboarded) return <Navigate to="/welcome" replace />;
  return <Dashboard />;
}

function RequireAdmin({ children }) {
  const { session, profile, isAdmin } = useKip();
  if (session === undefined || (session && !profile)) return <Spinner full />;
  if (!session) return <Navigate to="/login" replace state={{ from: '/admin' }} />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/welcome" element={<Onboarding />} />
        <Route path="/share" element={<Share />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/trash" element={<Trash />} />
        <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UpgradeSheet />
      <Toast />
    </>
  );
}
