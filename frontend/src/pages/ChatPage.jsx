import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { disconnectSocket, socket } from '../lib/socket';
import { api } from '../lib/api';
import { ConversationList } from '../components/ConversationList';
import { MessageList } from '../components/MessageList';
import { MessageInput } from '../components/MessageInput';
import { ChatHeader } from '../components/ChatHeader';
import { UserSearch } from '../components/UserSearch';
import { LogOut, User, Shield, Search } from 'lucide-react';

export function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { conversations, currentConversation, selectConversation, fetchConversations } = useChatStore();
  const [showSidebar, setShowSidebar] = useState(window.innerWidth >= 768);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchConversations();
    return () => {
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    if (conversationId) {
      const conv = conversations.find((c) => c.id === conversationId);
      if (conv) selectConversation(conv);
    }
  }, [conversationId, conversations]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setShowSidebar(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    api.get('/api/auth/me').then((res) => {
      setIsAdmin(res.data.user?.role === 'ADMIN');
    }).catch(() => {});
  }, []);

  const handleSelectConversation = useCallback((conv) => {
    selectConversation(conv);
    navigate(`/chat/${conv.id}`);
    if (window.innerWidth < 768) setShowSidebar(false);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="h-screen flex bg-gray-100">
      {showSidebar && (
        <div className="w-full md:w-80 lg:w-96 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">TalkLight</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 hover:bg-gray-100 rounded-full"
                title="Rechercher"
              >
                <Search className="w-5 h-5 text-gray-600" />
              </button>
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="p-2 hover:bg-gray-100 rounded-full"
                  title="Admin"
                >
                  <Shield className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <User className="w-5 h-5 text-gray-600" />
                </button>
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <button
                      onClick={() => { navigate('/profile'); setShowProfileMenu(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <User className="w-4 h-4" /> Profil
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" /> Déconnexion
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {showSearch ? (
            <UserSearch
              onSelectUser={(userId) => {
                api.post('/api/conversations/start', { userId }).then((res) => {
                  fetchConversations();
                  const conv = res.data.conversation;
                  handleSelectConversation(conv);
                  setShowSearch(false);
                });
              }}
              onClose={() => setShowSearch(false)}
            />
          ) : (
            <ConversationList
              conversations={conversations}
              currentId={currentConversation?.id}
              onSelect={handleSelectConversation}
            />
          )}
        </div>
      )}

      {currentConversation ? (
        <div className="flex-1 flex flex-col min-w-0">
          <ChatHeader
            conversation={currentConversation}
            onToggleSidebar={() => setShowSidebar(!showSidebar)}
          />
          <MessageList />
          <MessageInput conversationId={currentConversation.id} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-lg">Sélectionnez une conversation</p>
            <p className="text-sm mt-1">ou recherchez un utilisateur</p>
          </div>
        </div>
      )}
    </div>
  );
}
