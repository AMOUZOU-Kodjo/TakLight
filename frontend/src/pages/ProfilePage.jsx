import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { User, Save, ArrowLeft, Camera, Loader2, Shield, Mail, Calendar, Edit3, Check } from 'lucide-react';

export function ProfilePage() {
  const { user, updateProfile } = useAuthStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      await updateProfile({ username, bio });
      setSuccess('Profil mis à jour');
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await api.post('/api/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      useAuthStore.getState().setUser({ ...useAuthStore.getState().user, avatarUrl: response.data.avatarUrl });
      setSuccess('Avatar mis à jour');
    } catch {
      setError("Erreur lors de l'upload de l'avatar");
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" /> Retour
        </button>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-primary-500 to-primary-700" />
          
          <div className="px-8 pb-8">
            <div className="flex items-end -mt-12 mb-6">
              <div className="relative">
                <div className="w-24 h-24 bg-white rounded-full p-1 shadow-lg">
                  <div className="w-full h-full bg-primary-100 rounded-full flex items-center justify-center overflow-hidden">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.username} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-12 h-12 text-primary-600" />
                    )}
                  </div>
                </div>
                <label className="absolute bottom-0 right-0 p-2 bg-primary-600 rounded-full cursor-pointer hover:bg-primary-700 shadow-lg transition-colors">
                  <Camera className="w-4 h-4 text-white" />
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
              </div>
              <div className="ml-4 flex-1">
                <h1 className="text-2xl font-bold text-gray-900">{user.username}</h1>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {user.role === 'ADMIN' && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Admin
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="flex items-center gap-3 text-gray-600">
                <Mail className="w-5 h-5 text-gray-400" />
                <span className="text-sm">{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <Calendar className="w-5 h-5 text-gray-400" />
                <span className="text-sm">Membre depuis {new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Informations personnelles</h2>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                  >
                    <Edit3 className="w-4 h-4" /> Modifier
                  </button>
                )}
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                    Nom d'utilisateur
                  </label>
                  {isEditing ? (
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="input-field"
                      pattern="^[a-zA-Z0-9_]+$"
                      minLength={3}
                      maxLength={50}
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">@{user.username}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                    Bio
                  </label>
                  {isEditing ? (
                    <>
                      <textarea
                        id="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="input-field resize-none"
                        rows={3}
                        maxLength={500}
                      />
                      <p className="mt-1 text-xs text-gray-500">{bio.length}/500</p>
                    </>
                  ) : (
                    <p className="text-gray-600">{user.bio || 'Aucune bio'}</p>
                  )}
                </div>

                {isEditing && (
                  <div className="flex gap-3 pt-2">
                    <button type="submit" className="btn-primary" disabled={isSaving}>
                      {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                      {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsEditing(false); setUsername(user.username); setBio(user.bio); }}
                      className="btn-secondary"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
