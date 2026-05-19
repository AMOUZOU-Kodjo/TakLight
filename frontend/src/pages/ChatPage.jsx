import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { disconnectSocket } from '../lib/socket';
import { api } from '../lib/api';
import { ConversationList } from '../components/ConversationList';
import { MessageList } from '../components/MessageList';
import { MessageInput } from '../components/MessageInput';
import { ChatHeader } from '../components/ChatHeader';
import { UserSearch } from '../components/UserSearch';
import { UserList } from '../components/UserList';
import { LogOut, User, Shield, Search, Menu, X } from 'lucide-react';

export function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { conversations, currentConversation, selectConversation, fetchConversations } = useChatStore();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
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
      if (window.innerWidth >= 768) setSidebarOpen(true);
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
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  const handleStartConversation = useCallback(async (targetUser) => {
    try {
      const res = await api.post('/api/conversations/start', { userId: targetUser.id });
      fetchConversations();
      const conv = res.data.conversation;
      handleSelectConversation(conv);
    } catch {}
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebar = (
    <div className="h-full flex flex-col bg-white">
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
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-full md:hidden"
            title="Fermer"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
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
  );

  return (
    <div className="h-screen flex bg-gray-100 overflow-hidden relative">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`
          fixed md:relative z-30 md:z-0 h-full
          w-72 lg:w-80 flex-shrink-0 bg-white border-r border-gray-200
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {sidebar}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {currentConversation ? (
          <>
            <ChatHeader
              conversation={currentConversation}
              onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
            />
            <MessageList />
            <MessageInput conversationId={currentConversation.id} />
          </>
        ) : (
          <>
            <div className="hidden md:flex flex-1 flex-col items-center justify-center text-gray-500 px-4">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="mb-4 p-3 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors shadow-lg"
                >
                  <Menu className="w-6 h-6" />
                </button>
              )}
              <p className="text-lg font-medium">Sélectionnez une conversation</p>
              <p className="text-sm mt-1 text-gray-400">ou recherchez un utilisateur</p>
            </div>
            <div className="md:hidden flex-1 flex flex-col">
              <UserList onSelectUser={handleStartConversation} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
