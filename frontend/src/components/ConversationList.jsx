import { useChatStore } from '../store/chatStore';
import { User, Clock } from 'lucide-react';

export function ConversationList({ conversations, currentId, onSelect }) {
  const { presence } = useChatStore();

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Aucune conversation</p>
          <p className="text-gray-400 text-xs mt-1">Partagez votre lien d'invitation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conv) => {
        const isOnline = presence[conv.otherUser.id]?.status === 'online';
        const isSelected = conv.id === currentId;

        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={`w-full p-3 sm:p-4 flex items-center gap-2 sm:gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
              isSelected ? 'bg-primary-50 hover:bg-primary-50' : ''
            }`}
          >
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary-100 rounded-full flex items-center justify-center">
                {conv.otherUser.avatarUrl ? (
                  <img
                    src={conv.otherUser.avatarUrl}
                    alt={conv.otherUser.username}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
                )}
              </div>
              {isOnline && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full border-2 border-white" />
              )}
            </div>

            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900 truncate text-sm sm:text-base">{conv.otherUser.username}</p>
                {conv.lastMessageAt && (
                  <span className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    {formatDate(conv.lastMessageAt)}
                  </span>
                )}
              </div>
              {conv.lastMessage && (
                <p className="text-xs sm:text-sm text-gray-500 truncate mt-0.5">{conv.lastMessage}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Hier';
  } else if (days < 7) {
    return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }
}
