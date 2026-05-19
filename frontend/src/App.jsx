import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { useAuthStore } from './store/authStore';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ChatPage } from './pages/ChatPage';
import { ProfilePage } from './pages/ProfilePage';
import { InvitePage } from './pages/InvitePage';
import { AdminPage } from './pages/AdminPage';
import { VideoCallPage } from './pages/VideoCallPage';
import { ConnectionBanner } from './components/ConnectionBanner';
import { IncomingCall } from './components/IncomingCall';
import { socket, connectSocket } from './lib/socket';
import { requestNotificationPermission } from './lib/notifications';

function AppInit() {
  const { fetchMe, isInitialized, initDarkMode } = useAuthStore();
  useEffect(() => {
    initDarkMode();
    requestNotificationPermission();
    if (!isInitialized) {
      fetchMe();
    }
  }, [fetchMe, isInitialized, initDarkMode]);
  return null;
}

function CallHandler() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    if (!user) return;
    connectSocket();

    const handleIncoming = ({ from, conversationId, caller }) => {
      setIncomingCall({ from, conversationId, caller });
    };

    const handleAccepted = ({ conversationId }) => {
      setIncomingCall(null);
    };

    const handleRejected = ({ conversationId }) => {
      setIncomingCall(null);
    };

    const handleEnded = ({ conversationId }) => {
      setIncomingCall(null);
    };

    socket.on('call:incoming', handleIncoming);
    socket.on('call:accepted', handleAccepted);
    socket.on('call:rejected', handleRejected);
    socket.on('call:ended', handleEnded);

    return () => {
      socket.off('call:incoming', handleIncoming);
      socket.off('call:accepted', handleAccepted);
      socket.off('call:rejected', handleRejected);
      socket.off('call:ended', handleEnded);
    };
  }, [user, navigate]);

  if (!incomingCall) return null;

  return (
    <IncomingCall
      caller={incomingCall.caller || { id: incomingCall.from, username: '...' }}
      onAccept={() => {
        socket.emit('call:accept', { target: incomingCall.from, conversationId: incomingCall.conversationId });
        setIncomingCall(null);
        navigate(`/call/${incomingCall.conversationId}?with=${incomingCall.from}&incoming=true`);
      }}
      onReject={() => {
        socket.emit('call:reject', { target: incomingCall.from, conversationId: incomingCall.conversationId });
        setIncomingCall(null);
      }}
    />
  );
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
    <HelmetProvider>
      <Helmet>
        <html lang="fr" />
        <meta property="og:title" content="TalkLight - Messagerie instantanée" />
        <meta property="og:description" content="La messagerie qui parle même sur petit débit. Chattez en temps réel, passez des appels vidéo, même avec une connexion faible." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://talklight.onrender.com" />
        <meta property="og:image" content="https://talklight.onrender.com/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="TalkLight - Messagerie instantanée" />
        <meta name="twitter:description" content="La messagerie qui parle même sur petit débit." />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": "TalkLight",
          "description": "Messagerie instantanée optimisée pour les connexions faibles",
          "applicationCategory": "Communication",
          "operatingSystem": "Web",
          "offers": { "@type": "Offer", "price": "0" }
        })}</script>
      </Helmet>
      <AppInit />
      <ConnectionBanner />
      <CallHandler />
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
    </HelmetProvider>
  );
}
