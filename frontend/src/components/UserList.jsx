import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { User, Loader2, Search } from 'lucide-react';

export function UserList({ onSelectUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchUsers = async (pageNum = 1, append = false) => {
    try {
      const params = { page: pageNum, limit: 30 };
      if (search.trim()) params.q = search.trim();
      const endpoint = search.trim() ? '/api/users/search' : '/api/users';
      const res = await api.get(endpoint, { params });
      if (append) {
        setUsers((prev) => [...prev, ...res.data.users]);
      } else {
        setUsers(res.data.users);
      }
      setHasMore(res.data.hasMore);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchUsers(1);
  }, [search]);

  useEffect(() => {
    if (page > 1) fetchUsers(page, true);
  }, [page]);

  const handleScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100 && hasMore && !loading) {
      setPage((p) => p + 1);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un utilisateur..."
            className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {loading && users.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <User className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => onSelectUser(u)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-primary-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{u.username}</p>
                  {u.bio && <p className="text-xs text-gray-500 truncate">{u.bio}</p>}
                </div>
              </button>
            ))}
            {loading && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
