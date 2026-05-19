import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export function InvitePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const response = await api.get(`/api/invitations/${slug}`);
        setInvitation(response.data.invitation);
      } catch (err) {
        setError(err.response?.data?.error || 'Invitation invalide');
      } finally {
        setLoading(false);
      }
    };
    fetchInvitation();
  }, [slug]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const response = await api.post(`/api/invitations/${slug}/accept`);
      if (response.data.conversation) {
        navigate(`/chat/${response.data.conversation.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'acceptation");
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitation invalide</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={() => navigate('/login')} className="btn-primary">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  const inviteUrl = `${window.location.origin}/invite/${slug}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {invitation.user.username} vous invite
          </h1>
          <p className="text-gray-600 mb-6">Rejoignez la conversation sur TalkLight</p>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 inline-block">
            <QRCodeSVG value={inviteUrl} size={180} />
          </div>

          <div className="flex gap-3">
            <button onClick={() => navigate('/login')} className="btn-secondary flex-1">
              <ArrowLeft className="w-4 h-4 mr-2" /> Connexion
            </button>
            <button onClick={handleAccept} className="btn-primary flex-1" disabled={accepting}>
              {accepting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Accepter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
