import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import {
  Users, MessageSquare, ArrowLeft, Search, Shield, UserX,
  CheckCircle, XCircle, BarChart3, Clock, Eye, Trash2,
  Download, Image, Mic, MessageCircle, TrendingUp, Activity,
} from 'lucide-react';

export function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [selectedConv, setSelectedConv] = useState(null);
  const [convMessages, setConvMessages] = useState([]);

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      navigate('/chat');
      return;
    }
    loadDashboard();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'conversations') loadConversations();
    if (activeTab === 'activity') loadActivity();
  }, [activeTab]);

  const loadDashboard = async () => {
    try {
      const res = await api.get('/api/admin/stats');
      setStats(res.data.stats);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await api.get('/api/admin/users', { params: { search: userSearch || undefined } });
      setUsers(res.data.users);
    } catch {}
  };

  const loadConversations = async () => {
    try {
      const res = await api.get('/api/admin/conversations');
      setConversations(res.data.conversations);
    } catch {}
  };

  const loadActivity = async () => {
    try {
      const res = await api.get('/api/admin/activity');
      setActivity(res.data);
    } catch {}
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    await api.patch(`/api/admin/users/${userId}`, { isActive: !currentStatus });
    loadUsers();
  };

  const toggleUserRole = async (userId, currentRole) => {
    await api.patch(`/api/admin/users/${userId}`, { role: currentRole === 'ADMIN' ? 'USER' : 'ADMIN' });
    loadUsers();
  };

  const deleteUser = async (userId) => {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    await api.delete(`/api/admin/users/${userId}`);
    loadUsers();
  };

  const deleteMessage = async (messageId) => {
    if (!confirm('Supprimer ce message ?')) return;
    await api.delete(`/api/admin/messages/${messageId}`);
    viewConversation(selectedConv);
  };

  const viewConversation = async (conv) => {
    setSelectedConv(conv);
    try {
      const res = await api.get(`/api/admin/conversations/${conv.id}/messages`);
      setConvMessages(res.data.messages);
    } catch {}
  };

  const exportUsers = async () => {
    const res = await api.get('/api/admin/export/users', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'users-export.json');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/chat')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary-600" />
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>Connecté en tant que</span>
            <span className="font-medium text-gray-900 dark:text-white">{user?.username}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-fit">
          {[
            { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
            { id: 'users', label: 'Utilisateurs', icon: Users },
            { id: 'conversations', label: 'Conversations', icon: MessageSquare },
            { id: 'activity', label: 'Activité', icon: Clock },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedConv(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-8">
        {activeTab === 'dashboard' && stats && <DashboardStats stats={stats} />}
        {activeTab === 'users' && (
          <UsersTab
            users={users}
            search={userSearch}
            onSearchChange={setUserSearch}
            onSearch={loadUsers}
            onToggleStatus={toggleUserStatus}
            onToggleRole={toggleUserRole}
            onDelete={deleteUser}
            onExport={exportUsers}
          />
        )}
        {activeTab === 'conversations' && !selectedConv && (
          <ConversationsTab conversations={conversations} onView={viewConversation} />
        )}
        {activeTab === 'conversations' && selectedConv && (
          <ConversationDetail conv={selectedConv} messages={convMessages} onBack={() => setSelectedConv(null)} onDeleteMessage={deleteMessage} />
        )}
        {activeTab === 'activity' && activity && <ActivityTab activity={activity} />}
      </div>
    </div>
  );
}

function DashboardStats({ stats }) {
  const mainCards = [
    { label: 'Total utilisateurs', value: stats.totalUsers, icon: Users, color: 'bg-blue-500', trend: `+${stats.newUsersToday} aujourd'hui` },
    { label: 'Utilisateurs actifs', value: stats.activeUsers, icon: CheckCircle, color: 'bg-green-500', trend: `${stats.inactiveUsers} inactifs` },
    { label: 'Conversations', value: stats.totalConversations, icon: MessageSquare, color: 'bg-purple-500', trend: 'Total' },
    { label: 'Messages', value: stats.totalMessages, icon: BarChart3, color: 'bg-orange-500', trend: `${stats.messagesToday} aujourd'hui` },
  ];

  const mediaCards = [
    { label: 'Messages texte', value: stats.mediaStats.text, icon: MessageCircle, color: 'bg-gray-500' },
    { label: 'Photos envoyées', value: stats.mediaStats.image, icon: Image, color: 'bg-pink-500' },
    { label: 'Audios envoyés', value: stats.mediaStats.audio, icon: Mic, color: 'bg-teal-500' },
    { label: 'Nouveaux (7j)', value: stats.newUsersThisWeek, icon: TrendingUp, color: 'bg-indigo-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainCards.map((card) => (
          <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                <p className="text-3xl font-bold mt-1">{card.value}</p>
                <p className="text-xs text-gray-400 mt-1">{card.trend}</p>
              </div>
              <div className={`p-3 rounded-lg ${card.color}`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Statistiques médias</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {mediaCards.map((card) => (
          <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                <p className="text-3xl font-bold mt-1">{card.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${card.color}`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersTab({ users, search, onSearchChange, onSearch, onToggleStatus, onToggleRole, onDelete, onExport }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              placeholder="Rechercher par nom ou email..."
              className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button onClick={onSearch} className="btn-primary text-sm">Rechercher</button>
        </div>
        <button onClick={onExport} className="btn-secondary text-sm flex items-center gap-2">
          <Download className="w-4 h-4" /> Exporter
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Utilisateur</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rôle</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Conversations</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Messages</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <span className="text-sm font-medium text-primary-600">{u.username[0].toUpperCase()}</span>
                      )}
                    </div>
                    <span className="font-medium">{u.username}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    u.role === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    u.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                    {u.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{u.conversationCount}</td>
                <td className="px-4 py-3 text-sm">{u.messageCount}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleRole(u.id, u.role)}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-purple-500"
                      title={u.role === 'ADMIN' ? 'Retirer admin' : 'Donner admin'}
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onToggleStatus(u.id, u.isActive)}
                      className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        u.isActive ? 'text-red-500' : 'text-green-500'
                      }`}
                      title={u.isActive ? 'Désactiver' : 'Activer'}
                    >
                      {u.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => onDelete(u.id)}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConversationsTab({ conversations, onView }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="font-semibold">Toutes les conversations</h2>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {conversations.map((conv) => (
          <div key={conv.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium">{conv.user1.username} ↔ {conv.user2.username}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">{conv.lastMessage || 'Aucun message'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">{conv.messageCount} messages</span>
              <button onClick={() => onView(conv)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConversationDetail({ conv, messages, onBack, onDeleteMessage }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-semibold">{conv.user1.username} ↔ {conv.user2.username}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{messages.length} messages</p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id} className="flex items-start justify-between group">
            <div className={`max-w-xs px-4 py-2 rounded-lg ${
              msg.sender.id === conv.user1.id ? 'bg-gray-100 dark:bg-gray-700' : 'bg-primary-100'
            }`}>
              <p className="text-xs font-medium mb-1">{msg.sender.username}</p>
              <p className="text-sm">{msg.isDeleted ? '[Supprimé]' : (msg.content || '[Média]')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {new Date(msg.sentAt).toLocaleString('fr-FR')}
              </p>
            </div>
            {!msg.isDeleted && (
              <button
                onClick={() => onDeleteMessage(msg.id)}
                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityTab({ activity }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <UserX className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold">Derniers inscrits</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {activity.recentUsers.map((u) => (
            <div key={u.id} className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <span className="text-sm font-medium text-primary-600">{u.username[0].toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{u.username}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(u.createdAt).toLocaleString('fr-FR')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold">Dernières conversations</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {activity.recentConversations.map((c) => (
            <div key={c.id} className="p-3">
              <p className="font-medium text-sm">{c.user1} ↔ {c.user2}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(c.createdAt).toLocaleString('fr-FR')}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold">Derniers messages</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {activity.recentMessages.map((m) => (
            <div key={m.id} className="p-3">
              <p className="text-sm"><span className="font-medium">{m.sender}</span> : {m.content || '[Média]'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(m.sentAt).toLocaleString('fr-FR')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
