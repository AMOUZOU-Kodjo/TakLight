import { useState } from 'react';
import { api } from '../lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { Share2, Copy, Check, X, Loader2, Link } from 'lucide-react';

export function InviteModal({ onClose }) {
  const [inviteUrl, setInviteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useState(() => {
    api.post('/api/invitations').then((res) => {
      setInviteUrl(res.data.invitation.url);
    }).catch(() => {
      setError('Erreur lors de la création du lien');
    }).finally(() => {
      setLoading(false);
    });
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'TalkLight', text: 'Rejoins-moi sur TalkLight !', url: inviteUrl });
      } catch {}
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-sm text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Inviter des amis</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : error ? (
          <p className="text-red-600 dark:text-red-400 text-sm py-4">{error}</p>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Partage ce lien avec tes amis pour les inviter sur TalkLight
            </p>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-4 inline-block">
              <QRCodeSVG value={inviteUrl} size={160} />
            </div>

            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-lg p-2 mb-4">
              <Link className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-xs text-gray-600 dark:text-gray-300 truncate flex-1">{inviteUrl}</span>
              <button
                onClick={handleCopy}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full shrink-0"
                title="Copier"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
              </button>
            </div>

            <button onClick={handleShare} className="btn-primary w-full flex items-center justify-center gap-2">
              <Share2 className="w-4 h-4" />
              Partager
            </button>
          </>
        )}
      </div>
    </div>
  );
}
