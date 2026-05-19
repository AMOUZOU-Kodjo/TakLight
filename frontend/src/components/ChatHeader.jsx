import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { ArrowLeft, User, Phone, Video, Search, X, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

export function ChatHeader({ conversation, onToggleSidebar }) {
  const { presence } = useChatStore();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef(null);
  const isOnline = presence[conversation.otherUser.id]?.status === 'online';
  const lastSeen = presence[conversation.otherUser.id]?.lastSeen;

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    if (!searchQuery.trim() || !conversation?.id) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get(`/api/conversations/${conversation.id}/search`, {
          params: { q: searchQuery, limit: 10 },
        });
        setSearchResults(res.data.messages);
      } catch {}
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, conversation?.id]);

  const startVideoCall = () => {
    const callUrl = `/call/${conversation.id}?with=${conversation.otherUser.id}`;
    window.open(callUrl, '_blank', 'width=800,height=600');
  };

  const scrollToMessage = (messageId) => {
    setShowSearch(false);
    setSearchQuery('');
    setTimeout(() => {
      const el = document.getElementById(`msg-${messageId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      {showSearch ? (
        <div className="px-3 sm:px-4 py-2 flex items-center gap-2">
          <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div className="flex-1 relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans la conversation..."
              className="w-full bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-200 dark:placeholder-gray-400"
            />
            {searching && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3">
          <button onClick={onToggleSidebar} className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full md:hidden">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 dark:text-gray-300" />
          </button>

          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
              {conversation.otherUser.avatarUrl ? (
                <img src={conversation.otherUser.avatarUrl} alt={conversation.otherUser.username} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover" />
              ) : (
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600 dark:text-primary-300" />
              )}
            </div>
            {isOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 dark:text-white truncate text-sm sm:text-base">{conversation.otherUser.username}</h2>
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
              {isOnline ? <span className="text-green-600">En ligne</span> : lastSeen ? `Vu ${formatLastSeen(lastSeen)}` : 'Hors ligne'}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => setShowSearch(true)} className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300" title="Rechercher">
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300" title="Appel audio">
              <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button onClick={startVideoCall} className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300" title="Appel vidéo">
              <Video className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      )}
      {showSearch && searchResults.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700 max-h-48 overflow-y-auto">
          {searchResults.map((msg) => (
            <button
              key={msg.id}
              onClick={() => scrollToMessage(msg.id)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-b border-gray-50 dark:border-gray-700"
            >
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="truncate text-gray-700 dark:text-gray-300">{msg.content}</span>
              <span className="text-xs text-gray-400 shrink-0">{new Date(msg.sentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            </button>
          ))}
        </div>
      )}
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
