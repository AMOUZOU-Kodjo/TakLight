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
import { LogOut, User, Shield, Search, Menu, X, Share2 } from 'lucide-react';
import { InviteModal } from '../components/InviteModal';

export function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { logout, darkMode } = useAuthStore();
  const { 
    conversations, 
    currentConversation, 
    selectConversation, 
    fetchConversations,
    isLoading 
  } = useChatStore();
  
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const profileMenuRef = useRef(null);

  // Chargement initial
  useEffect(() => {
    const initChat = async () => {
      await fetchConversations();
    };
    initChat();

    return () => {
      disconnectSocket();
    };
  }, [fetchConversations]);

  // Sélection de la conversation depuis l'URL
  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      const conversation = conversations.find((c) => c.id === conversationId);
      if (conversation) {
        selectConversation(conversation);
      }
    }
  }, [conversationId, conversations, selectConversation]);

  // Gestion responsive
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Vérification des droits admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await api.get('/api/auth/me');
        setIsAdmin(response.data.user?.role === 'ADMIN');
      } catch (error) {
        console.error('Erreur lors de la vérification admin:', error);
      }
    };
    
    checkAdminStatus();
  }, []);

  // Fermeture du menu profil au clic exterieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectConversation = useCallback((conversation) => {
    selectConversation(conversation);
    navigate(`/chat/${conversation.id}`);
    
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [navigate, selectConversation]);

  const createConversation = useCallback(async (userId) => {
    try {
      const response = await api.post('/api/conversations/start', { userId });
      await fetchConversations();
      if (response.data.conversation) {
        handleSelectConversation(response.data.conversation);
      }
      setShowSearch(false);
    } catch (error) {
      console.error('Erreur lors de la création de conversation:', error);
    }
  }, [fetchConversations, handleSelectConversation]);

  const handleStartConversation = useCallback((targetUser) => createConversation(targetUser.id), [createConversation]);

  const handleUserSearchSelect = useCallback((userId) => createConversation(userId), [createConversation]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleProfileNavigation = () => {
    setShowProfileMenu(false);
    navigate('/profile');
  };

  const handleAdminNavigation = () => {
    navigate('/admin');
  };

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  const toggleSearch = () => {
    setShowSearch(prev => !prev);
  };

  return (
    <div className="h-screen flex bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed md:relative z-30 md:z-0 h-full
          w-80 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="h-full flex flex-col bg-white dark:bg-gray-800">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">TalkLight</h1>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowInvite(true)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <Share2 className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>

                <button
                  onClick={toggleSearch}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  title="Rechercher"
                >
                  <Search className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
                
                {isAdmin && (
                  <button
                    onClick={handleAdminNavigation}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    title="Administration"
                  >
                    <Shield className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </button>
                )}
                
                <div className="relative" ref={profileMenuRef}>
                    <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    title="Profil"
                  >
                    <User className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </button>
                  
                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-50">
                      <button
                        onClick={() => { setShowMenu(false); navigate('/invite'); }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                      >
                        <Share2 className="w-4 h-4" />
                        Inviter
                      </button>
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => { setShowMenu(false); navigate('/admin'); }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                        >
                          <Shield className="w-4 h-4" />
                          Admin
                        </button>
                      )}
                      <button
                        onClick={() => { setShowMenu(false); navigate('/profile'); }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                      >
                        <User className="w-4 h-4" />
                        Profil
                      </button>
                      <button
                        onClick={() => useAuthStore.getState().toggleDarkMode()}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                      >
                        <span className="w-4 h-4 flex items-center justify-center">{darkMode ? '☀️' : '🌙'}</span>
                        {darkMode ? 'Mode clair' : 'Mode sombre'}
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 disabled:opacity-50"
                        disabled={loggingOut}
                      >
                        <LogOut className="w-4 h-4" />
                        {isLoggingOut ? 'Déconnexion...' : 'Déconnexion'}
                      </button>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={toggleSidebar}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors md:hidden"
                  title="Fermer"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            </div>
          </div>

          {showSearch ? (
            <UserSearch
              onSelectUser={handleUserSearchSelect}
              onClose={() => setShowSearch(false)}
            />
          ) : (
            <ConversationList
              conversations={conversations}
              currentId={currentConversation?.id}
              onSelect={handleSelectConversation}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>

      {/* Zone principale */}
      <div className="flex-1 flex flex-col min-w-0">
        {currentConversation ? (
          <>
            <ChatHeader
              conversation={currentConversation}
              onToggleSidebar={toggleSidebar}
            />
            <MessageList onReply={setReplyToMessage} />
            <MessageInput
              conversationId={currentConversation.id}
              replyTo={replyToMessage}
              onCancelReply={() => setReplyToMessage(null)}
            />
          </>
        ) : (
          <>
            <div className="hidden md:flex flex-1 flex-col items-center justify-center text-gray-500 dark:text-gray-400 px-4">
              {!sidebarOpen && (
                <button
                  onClick={toggleSidebar}
                  className="mb-4 p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg"
                >
                  <Menu className="w-6 h-6" />
                </button>
              )}
              <p className="text-lg font-medium">Sélectionnez une conversation</p>
              <p className="text-sm mt-1 text-gray-400">ou recherchez un utilisateur</p>
            </div>
            
            <div className="md:hidden flex-1 flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <button
                  onClick={toggleSidebar}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  <Menu className="w-5 h-5" />
                  <span>Menu</span>
                </button>
              </div>
              <UserList onSelectUser={handleStartConversation} />
            </div>
          </>
        )}
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}