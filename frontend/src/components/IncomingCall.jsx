import { useEffect } from 'react';
import { Phone, PhoneOff, User } from 'lucide-react';
import { playRingtone, stopRingtone } from '../lib/ringtone';

export function IncomingCall({ caller, onAccept, onReject }) {
  useEffect(() => {
    playRingtone();
    return () => stopRingtone();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 animate-fade-in">
      <div className="bg-gray-900 rounded-3xl shadow-2xl px-8 pb-8 pt-6 w-full max-w-sm text-center animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-4 bg-primary-600 rounded-full flex items-center justify-center">
          {caller.avatarUrl ? (
            <img src={caller.avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <User className="w-10 h-10 text-white" />
          )}
        </div>
        <h2 className="text-xl font-semibold text-white mb-1">{caller.username || 'Inconnu'}</h2>
        <p className="text-gray-400 mb-8">Appel vidéo entrant...</p>
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={onReject}
            className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>
          <button
            onClick={onAccept}
            className="p-4 rounded-full bg-green-500 hover:bg-green-600 transition-colors"
          >
            <Phone className="w-7 h-7 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
