import { useChatStore } from '../store/chatStore';
import { ArrowLeft, User, Phone, Video } from 'lucide-react';

export function ChatHeader({ conversation, onToggleSidebar }) {
  const { presence } = useChatStore();
  const isOnline = presence[conversation.otherUser.id]?.status === 'online';
  const lastSeen = presence[conversation.otherUser.id]?.lastSeen;

  const startVideoCall = () => {
    const callUrl = `/call/${conversation.id}?with=${conversation.otherUser.id}`;
    window.open(callUrl, '_blank', 'width=800,height=600');
  };

  return (
    <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3">
      <button
        onClick={onToggleSidebar}
        className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full md:hidden"
      >
        <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary-100 rounded-full flex items-center justify-center">
          {conversation.otherUser.avatarUrl ? (
            <img
              src={conversation.otherUser.avatarUrl}
              alt={conversation.otherUser.username}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover"
            />
          ) : (
            <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
          )}
        </div>
        {isOnline && (
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full border-2 border-white" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-gray-900 truncate text-sm sm:text-base">{conversation.otherUser.username}</h2>
        <p className="text-[10px] sm:text-xs text-gray-500">
          {isOnline ? (
            <span className="text-green-600">En ligne</span>
          ) : lastSeen ? (
            `Vu ${formatLastSeen(lastSeen)}`
          ) : (
            'Hors ligne'
          )}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <button className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full text-gray-600" title="Appel audio">
          <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <button
          onClick={startVideoCall}
          className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full text-gray-600"
          title="Appel vidéo"
        >
          <Video className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </div>
  );
}

function formatLastSeen(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (hours < 24) return `il y a ${hours}h`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
