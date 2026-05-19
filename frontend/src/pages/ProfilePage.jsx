import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { 
  User, Save, ArrowLeft, Camera, Loader2, Shield, Mail, 
  Calendar, Edit3, Check, X, AlertCircle, CheckCircle 
} from 'lucide-react';

export function ProfilePage() {
  const { user, updateProfile } = useAuthStore();
  const navigate = useNavigate();
  
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  
  const fileInputRef = useRef(null);
  const usernameInputRef = useRef(null);

  // Focus sur le champ username quand on active l'édition
  useEffect(() => {
    if (isEditing && usernameInputRef.current) {
      usernameInputRef.current.focus();
    }
  }, [isEditing]);

  // Réinitialiser les messages après 3 secondes
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Validation
    if (username.trim().length < 3) {
      setError('Le nom d\'utilisateur doit contenir au moins 3 caractères');
      return;
    }
    
    if (username.trim().length > 50) {
      setError('Le nom d\'utilisateur ne peut pas dépasser 50 caractères');
      return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et underscores');
      return;
    }

    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      await updateProfile({ username: username.trim(), bio: bio.trim() });
      setSuccess('Profil mis à jour avec succès');
      setIsEditing(false);
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Erreur lors de la mise à jour du profil';
      setError(errorMessage);
      
      // Restaurer les valeurs originales en cas d'erreur
      setUsername(user?.username || '');
      setBio(user?.bio || '');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation du fichier
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Format d\'image non supporté. Utilisez JPG, PNG, GIF ou WEBP');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('L\'image ne doit pas dépasser 5MB');
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await api.post('/api/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      useAuthStore.getState().setUser({ 
        ...useAuthStore.getState().user, 
        avatarUrl: response.data.avatarUrl 
      });
      
      setSuccess('Avatar mis à jour avec succès');
      setAvatarPreview(null);
    } catch (err) {
      setError("Erreur lors de l'upload de l'avatar");
      setAvatarPreview(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setUsername(user?.username || '');
    setBio(user?.bio || '');
    setError('');
  };

  const triggerAvatarUpload = () => {
    fileInputRef.current?.click();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header avec navigation */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 transition-all duration-200"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>Retour</span>
          </button>
        </div>

        {/* Messages de notification */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 rounded-lg animate-slideIn">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-700 dark:text-red-400 text-sm flex-1">{error}</p>
              <button onClick={() => setError('')} className="text-red-600 hover:text-red-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 rounded-lg animate-slideIn">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-green-700 dark:text-green-400 text-sm flex-1">{success}</p>
              <button onClick={() => setSuccess('')} className="text-green-600 hover:text-green-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Carte principale */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-2xl">
          {/* Bannière de couverture */}
          <div className="relative h-40 bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700">
            <div className="absolute inset-0 bg-black opacity-0 hover:opacity-10 transition-opacity" />
          </div>
          
          {/* Section avatar et informations principales */}
          <div className="px-8 pb-8">
            <div className="flex flex-col md:flex-row items-start md:items-end -mt-16 mb-6 gap-4">
              <div className="relative group">
                <div className="w-28 h-28 md:w-32 md:h-32 bg-white dark:bg-gray-800 rounded-2xl p-1 shadow-xl">
                  <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-50 rounded-xl flex items-center justify-center overflow-hidden">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                    ) : user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <User className="w-12 h-12 md:w-16 md:h-16 text-primary-600" />
                    )}
                  </div>
                </div>
                
                <button
                  onClick={triggerAvatarUpload}
                  disabled={isUploading}
                  className="absolute bottom-2 right-2 p-2 bg-primary-600 rounded-full cursor-pointer hover:bg-primary-700 shadow-lg transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Changer l'avatar"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4 text-white" />
                  )}
                </button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/gif,image/webp"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {user.username}
                </h1>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  {user.role === 'ADMIN' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-100 to-purple-50 text-purple-700 rounded-full text-xs font-medium">
                      <Shield className="w-3 h-3" />
                      Administrateur
                    </span>
                  )}
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Membre depuis {new Date(user.createdAt).toLocaleDateString('fr-FR', { 
                      year: 'numeric', 
                      month: 'long' 
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Informations de contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <Mail className="w-4 h-4 text-primary-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <Calendar className="w-4 h-4 text-primary-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Date d'inscription</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(user.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Section des informations personnelles */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Informations personnelles</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gérez vos informations de profil</p>
                </div>
                
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-all duration-200"
                  >
                    <Edit3 className="w-4 h-4" />
                    Modifier
                  </button>
                )}
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                <div>
                  <label htmlFor="username" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Nom d'utilisateur
                  </label>
                  {isEditing ? (
                    <div>
                      <input
                        ref={usernameInputRef}
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                        placeholder="Nom d'utilisateur"
                        pattern="^[a-zA-Z0-9_]+$"
                        minLength={3}
                        maxLength={50}
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Lettres, chiffres et underscores uniquement. 3-50 caractères.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 dark:text-gray-400">@</span>
                      <span className="text-gray-900 dark:text-white font-medium">{user.username}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="bio" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Bio
                  </label>
                  {isEditing ? (
                    <div>
                      <textarea
                        id="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 resize-none"
                        rows={4}
                        maxLength={500}
                        placeholder="Parlez-nous un peu de vous..."
                      />
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {bio.length}/500 caractères
                        </p>
                        {bio.length === 500 && (
                          <p className="text-xs text-orange-500">Limite atteinte</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                        {user.bio || <span className="text-gray-400 dark:text-gray-400 italic">Aucune bio pour le moment</span>}
                      </p>
                    </div>
                  )}
                </div>

                {isEditing && (
                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex items-center justify-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Sauvegarde...
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          Sauvegarder
                        </>
                      )}
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="flex items-center justify-center gap-2 px-6 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
                    >
                      <X className="w-5 h-5" />
                      Annuler
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>

        {/* Section aide */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-400">
            Besoin d'aide ? Contactez le support
          </p>
        </div>
      </div>

      {/* Styles d'animation */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
