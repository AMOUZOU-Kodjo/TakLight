import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { Check, CheckCheck, AlertCircle, Loader2, Play, Pause, Image, Reply, MoreVertical, Trash2 } from 'lucide-react';

export function MessageList({ onReply }) {
  const { messages, isLoading, hasMore, nextCursor, fetchMessages, currentConversation, typingUsers } = useChatStore();
  const { user } = useAuthStore();
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleScroll = async () => {
    if (!containerRef.current || !hasMore || isLoading) return;
    if (containerRef.current.scrollTop === 0 && nextCursor) {
      await fetchMessages(currentConversation.id, nextCursor);
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3 chat-bg"
    >
      {isLoading && messages.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <MessageBubble key={message.id || message.tempId} message={message} isOwn={message.senderId === user?.id} onReply={onReply} />
          ))}
          {typingUsers.size > 0 && currentConversation && (
            <div className="flex items-center gap-2 text-gray-500 text-sm italic px-1 sm:px-4 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>{currentConversation.otherUser.username} est en train d'écrire</span>
            </div>
          )}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

function MessageBubble({ message, isOwn, onReply }) {
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const audioRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const { deleteMessage } = useChatStore();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (message.isDeleted) {
    return (
      <div className={`flex items-center gap-2 ${isOwn ? 'justify-end' : 'justify-start'} animate-fade-in py-1`}>
        {!isOwn && (
          <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-gray-300">
            {message.sender?.avatarUrl ? (
              <img src={message.sender.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] sm:text-xs font-semibold text-gray-600">
                {message.sender?.username?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </div>
        )}
        <div className="max-w-[85%] sm:max-w-[75%] px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-500 italic text-xs sm:text-sm">
          Message supprimé
        </div>
      </div>
    );
  }

  const toggleAudio = () => {
    if (audioRef.current) {
      if (audioPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setAudioPlaying(!audioPlaying);
    }
  };

  const formatAudioTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (message.isDeleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div className={`px-4 py-2 italic text-sm opacity-60 ${isOwn ? 'message-bubble-sent' : 'message-bubble-received'}`}>
          Message supprimé
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} items-end gap-1.5 sm:gap-2 animate-fade-in`}>
      {!isOwn && (
        <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-gray-300">
          {message.sender?.avatarUrl ? (
            <img src={message.sender.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] sm:text-xs font-semibold text-gray-600">
              {message.sender?.username?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
        </div>
      )}
      <div className="group relative max-w-[85%] sm:max-w-[75%] px-3 sm:px-4 py-1.5 sm:py-2 shadow-sm ${
        isOwn ? 'message-bubble-sent' : 'message-bubble-received'
      } ${message.localStatus === 'failed' ? 'opacity-70' : ''}">
        {message.replyTo && (
          <div className={`mb-1.5 pl-2 border-l-2 ${isOwn ? 'border-white/50' : 'border-primary-400'} text-xs opacity-80`}>
            <p className="font-medium truncate">{message.replyTo.sender?.username || 'Message'}</p>
            <p className="truncate">{message.replyTo.content || (message.replyTo.mediaType === 'image' ? '📷 Photo' : message.replyTo.mediaType === 'audio' ? '🎤 Audio' : '📎 Fichier')}</p>
          </div>
        )}
        {message.mediaType === 'image' ? (
          <div className="space-y-1.5">
            <div className="relative rounded-lg overflow-hidden bg-gray-200">
              {!imageLoaded && <div className="w-full aspect-video skeleton" />}
              {message.mediaUrl && (
                <img
                  src={message.mediaThumbnailUrl || message.mediaUrl}
                  alt="Photo"
                  className={`w-full max-w-[280px] sm:max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${imageLoaded ? 'block' : 'hidden'}`}
                  loading="lazy"
                  onLoad={() => setImageLoaded(true)}
                  onClick={() => window.open(message.mediaUrl, '_blank')}
                />
              )}
            </div>
            {message.content && <p className="text-sm">{message.content}</p>}
          </div>
        ) : message.mediaType === 'audio' ? (
          <div className="flex items-center gap-2 sm:gap-3 min-w-[160px] sm:min-w-[200px]">
            <button
              onClick={toggleAudio}
              className={`p-2 sm:p-2.5 rounded-full flex-shrink-0 ${
                isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-gray-100 hover:bg-gray-200'
              } transition-colors`}
            >
              {audioPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className={`h-1 rounded-full overflow-hidden ${isOwn ? 'bg-white/30' : 'bg-gray-200'}`}>
                <div
                  className={`h-full rounded-full transition-all ${isOwn ? 'bg-white' : 'bg-primary-600'}`}
                  style={{ width: `${audioDuration ? (audioCurrentTime / audioDuration) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs opacity-70">{formatAudioTime(audioCurrentTime)}</span>
                <span className="text-xs opacity-70">{formatAudioTime(audioDuration)}</span>
              </div>
            </div>
            <audio
              ref={audioRef}
              src={message.mediaUrl}
              onEnded={() => setAudioPlaying(false)}
              onTimeUpdate={() => setAudioCurrentTime(audioRef.current?.currentTime || 0)}
              onLoadedMetadata={() => setAudioDuration(audioRef.current?.duration || 0)}
            />
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        )}

        <div className={`flex items-center justify-end gap-0.5 mt-1 ${isOwn ? 'text-white/70' : 'text-gray-400'}`}>
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className={`p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/10 ${isOwn ? 'text-white/80' : 'text-gray-500'}`}
              title="Plus"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {showMenu && (
              <div className={`absolute bottom-full mb-1 ${isOwn ? 'right-0' : 'left-0'} bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 min-w-[180px] z-50`}>
                {onReply && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onReply(message); setShowMenu(false); }}
                    className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                  >
                    <Reply className="w-3.5 h-3.5" />
                    Répondre
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMessage(message.conversationId, message.id, false); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer pour moi
                </button>
                {isOwn && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteMessage(message.conversationId, message.id, true); setShowMenu(false); }}
                    className="w-full px-3 py-2 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer pour tout le monde
                  </button>
                )}
              </div>
            )}
          </div>
          <span className="text-xs">
            {new Date(message.sentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isOwn && <MessageStatus message={message} />}
        </div>
        {isOwn && (
          <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-gray-300">
            {message.sender?.avatarUrl ? (
              <img src={message.sender.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] sm:text-xs font-semibold text-gray-600">
                {message.sender?.username?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageStatus({ message }) {
  if (message.localStatus === 'pending') {
    return <Loader2 className="w-4 h-4 animate-spin" />;
  }
  if (message.localStatus === 'failed') {
    return <AlertCircle className="w-4 h-4 text-red-400" />;
  }
  if (message.readAt) {
    return <CheckCheck className="w-4 h-4 text-blue-300" />;
  }
  if (message.deliveredAt) {
    return <CheckCheck className="w-4 h-4" />;
  }
  return <Check className="w-4 h-4" />;
}
