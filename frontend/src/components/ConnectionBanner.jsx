import { useEffect, useState } from 'react';
import { WifiOff, AlertTriangle, Clock } from 'lucide-react';
import { offlineQueue } from '../lib/offlineQueue';

export function ConnectionBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState('unknown');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      offlineQueue.processQueue();
      offlineQueue.processPendingUploads();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const conn = navigator.connection;
    if (conn) {
      setConnectionType(conn.effectiveType || 'unknown');
      conn.addEventListener('change', () => {
        setConnectionType(conn.effectiveType || 'unknown');
      });
    }

    const interval = setInterval(async () => {
      const msgs = await offlineQueue.getQueuedMessagesCount();
      const uploads = await offlineQueue.getQueuedUploadsCount();
      setPendingCount(msgs + uploads);
    }, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const isSlowConnection = connectionType === 'slow-2g' || connectionType === '2g';

  if (isOnline && !isSlowConnection && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={`sticky top-0 z-50 px-3 sm:px-4 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2 animate-slide-down ${
        !isOnline
          ? 'bg-red-500 text-white animate-pulse-slow'
          : isSlowConnection
          ? 'bg-yellow-400 text-gray-900'
          : 'bg-blue-500 text-white'
      }`}
    >
      {!isOnline ? (
        <>
          <WifiOff className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
          <span>Hors connexion</span>
          {pendingCount > 0 && (
            <span className="opacity-90 hidden sm:inline">— {pendingCount} message{pendingCount > 1 ? 's' : ''} en attente</span>
          )}
          {pendingCount > 0 && (
            <span className="opacity-90 sm:hidden">({pendingCount})</span>
          )}
        </>
      ) : isSlowConnection ? (
        <>
          <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden sm:inline">Connexion très lente — Mode économie activé</span>
          <span className="sm:hidden">Connexion lente</span>
        </>
      ) : (
        <>
          <Clock className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
          <span>Envoi en cours ({pendingCount})</span>
        </>
      )}
    </div>
  );
}
