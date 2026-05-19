import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ChatPage } from './pages/ChatPage';
import { ProfilePage } from './pages/ProfilePage';
import { InvitePage } from './pages/InvitePage';
import { AdminPage } from './pages/AdminPage';
import { VideoCallPage } from './pages/VideoCallPage';
import { ConnectionBanner } from './components/ConnectionBanner';

function AppInit() {
  const { fetchMe, isInitialized } = useAuthStore();
  useEffect(() => {
    if (!isInitialized) {
      fetchMe();
    }
  }, [fetchMe, isInitialized]);
  return null;
}

function PrivateRoute({ children }) {
  const { user, isInitialized } = useAuthStore();
  if (!isInitialized) return null;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, isInitialized } = useAuthStore();
  if (!isInitialized) return null;
  return user ? <Navigate to="/chat" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <>
      <AppInit />
      <ConnectionBanner />
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/chat" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
        <Route path="/chat/:conversationId" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
        <Route path="/call/:conversationId" element={<PrivateRoute><VideoCallPage /></PrivateRoute>} />
        <Route path="/invite/:slug" element={<InvitePage />} />
        <Route path="/" element={<Navigate to="/chat" replace />} />
      </Routes>
    </>
  );
}
