import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { Check, CheckCheck, AlertCircle, Loader2, Play, Pause, Reply, MoreVertical, Trash2, CheckSquare, Square, Download } from 'lucide-react';

const GROUP_INTERVAL = 120000;

let globalAudioRef = null;
let globalAudioCallback = null;

export function MessageList({ onReply }) {
  const { messages, isLoading, hasMore, nextCursor, fetchMessages, currentConversation, typingUsers, selectedMessages, toggleSelectMessage, clearSelection } = useChatStore();
  const { user } = useAuthStore();
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const prevLengthRef = useRef(0);

  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLengthRef.current = messages.length;
  }, [messages]);

  const handleScroll = async () => {
    if (!containerRef.current || !hasMore || isLoading) return;
    if (containerRef.current.scrollTop === 0 && nextCursor) {
      const prevScrollHeight = containerRef.current.scrollHeight;
      await fetchMessages(currentConversation.id, nextCursor);
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight - prevScrollHeight;
        }
      });
    }
  };

  const groupedMessages = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const prev = messages[i - 1];
    const isConsecutive = prev && prev.senderId === msg.senderId && (new Date(msg.sentAt) - new Date(prev.sentAt)) < GROUP_INTERVAL;
    groupedMessages.push({ ...msg, showAvatar: !isConsecutive, isFirstInGroup: !isConsecutive });
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-2 sm:px-4 py-2 sm:py-4 chat-bg"
    >
      {isLoading && messages.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        </div>
      ) : (
        <>
          {groupedMessages.map((message, idx) => (
            <MessageBubble
              key={message.id || message.tempId}
              message={message}
              isOwn={message.senderId === user?.id}
              onReply={onReply}
              showAvatar={message.showAvatar}
              isFirstInGroup={message.isFirstInGroup}
              isSelected={selectedMessages.includes(message.id)}
              onToggleSelect={() => toggleSelectMessage(message.id)}
              selectMode={selectedMessages.length > 0}
              tempId={message.tempId}
            />
          ))}
          {typingUsers.size > 0 && currentConversation && (
            <div className="flex items-center gap-3 px-1 sm:px-4 py-2">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-300 flex-shrink-0">
                {currentConversation.otherUser.avatarUrl ? (
                  <img src={currentConversation.otherUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-gray-600">
                    {currentConversation.otherUser.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="bg-white dark:bg-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

function MessageBubble({ message, isOwn, onReply, showAvatar, isFirstInGroup, isSelected, onToggleSelect, selectMode, tempId }) {
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioSpeed, setAudioSpeed] = useState(1);
  const audioRef = useRef(null);
  const waveformRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const { deleteMessage } = useChatStore();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (message.isDeleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1 animate-fade-in`}>
        <div className={`max-w-[75%] px-4 py-2 italic text-sm opacity-50 rounded-2xl ${isOwn ? 'bg-primary-500/30 text-primary-200 rounded-tr-sm' : 'bg-gray-200/50 dark:bg-gray-600/50 text-gray-500 dark:text-gray-400 rounded-tl-sm'}`}>
          Message supprimé
        </div>
      </div>
    );
  }

  const handleBubbleClick = () => {
    if (selectMode && onToggleSelect) {
      onToggleSelect();
    }
  };

  const toggleAudio = useCallback(() => {
    if (audioRef.current) {
      if (audioPlaying) {
        audioRef.current.pause();
        setAudioPlaying(false);
      } else {
        if (globalAudioRef && globalAudioRef !== audioRef.current) {
          globalAudioRef.pause();
          if (globalAudioCallback) globalAudioCallback(false);
        }
        globalAudioRef = audioRef.current;
        globalAudioCallback = (playing) => setAudioPlaying(playing);
        audioRef.current.play().then(() => setAudioPlaying(true)).catch(() => {});
      }
    }
  }, [audioPlaying]);

  const handleAudioSeek = (e) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    audioRef.current.currentTime = ratio * audioDuration;
    setAudioCurrentTime(audioRef.current.currentTime);
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const next = speeds[(speeds.indexOf(audioSpeed) + 1) % speeds.length];
    setAudioSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const formatAudioTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    return `${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, '0')}`;
  };

  const WAVE_BARS = 32;

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} items-end mb-0.5 ${isOwn ? 'animate-fade-in-right' : 'animate-fade-in-left'}`}>
      {!isOwn && !selectMode && (
        <div className={`w-8 h-8 rounded-full overflow-hidden bg-gray-300 flex-shrink-0 mr-2 transition-all duration-200 ${showAvatar ? 'opacity-100 scale-100' : 'opacity-0 scale-0 pointer-events-none'}`}>
          {message.sender?.avatarUrl ? (
            <img src={message.sender.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-gray-600">
              {message.sender?.username?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
        </div>
      )}
      {selectMode && (
        <button onClick={onToggleSelect} className="mx-2 flex-shrink-0">
          {isSelected ? <CheckSquare className="w-5 h-5 text-primary-600" /> : <Square className="w-5 h-5 text-gray-400" />}
        </button>
      )}
      <div className={`max-w-[85%] sm:max-w-[70%] ${isOwn ? 'order-1' : 'order-1'}`}>
        <div
          onClick={handleBubbleClick}
          className={`
          relative px-3 sm:px-4 py-2 shadow-sm cursor-pointer
          ${isOwn
            ? 'bg-gradient-to-br from-primary-500 to-primary-700 text-white rounded-2xl rounded-tr-sm'
            : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-2xl rounded-tl-sm shadow-sm border border-gray-100 dark:border-gray-600'
          }
          ${message.localStatus === 'failed' ? 'opacity-70' : ''}
          ${isSelected ? (isOwn ? 'ring-2 ring-primary-300' : 'ring-2 ring-primary-400') : ''}
        `}>
          {message.replyTo && (
            <div className={`mb-2 pl-2.5 border-l-[3px] rounded-sm ${isOwn ? 'border-white/60' : 'border-primary-400'} text-xs`}>
              <p className={`font-semibold mb-0.5 ${isOwn ? 'text-white/90' : 'text-primary-600 dark:text-primary-400'}`}>{message.replyTo.sender?.username || 'Message'}</p>
              <p className={`truncate ${isOwn ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>{message.replyTo.content || (message.replyTo.mediaType === 'image' ? '📷 Photo' : message.replyTo.mediaType === 'audio' ? '🎤 Audio' : '📎 Fichier')}</p>
            </div>
          )}
          {message.mediaType === 'image' ? (
            <div className="-mx-3 -mt-2 sm:-mx-4">
              <div className="relative bg-gray-200 dark:bg-gray-600">
                {!imageLoaded && <div className="w-full aspect-video skeleton" />}
                {message.mediaUrl && (
                  <img
                    src={message.mediaThumbnailUrl || message.mediaUrl}
                    alt="Photo"
                    className={`w-full max-w-[280px] sm:max-w-sm cursor-pointer hover:opacity-95 transition-opacity ${imageLoaded ? 'block' : 'hidden'}`}
                    loading="lazy"
                    onLoad={() => setImageLoaded(true)}
                    onClick={(e) => { e.stopPropagation(); window.open(message.mediaUrl, '_blank'); }}
                  />
                )}
              </div>
              {message.content && <p className="text-sm px-3 sm:px-4 pt-2 pb-1">{message.content}</p>}
            </div>
          ) : message.mediaType === 'audio' ? (
            <div className={`min-w-[220px] sm:min-w-[260px] ${isOwn ? '' : ''}`}>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleAudio(); }}
                  className={`p-2 rounded-full flex-shrink-0 transition-all active:scale-95 ${
                    isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-primary-100 dark:bg-gray-600 hover:bg-primary-200 dark:hover:bg-gray-500'
                  }`}
                >
                  {audioPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleAudioSeek(e); }}>
                  <div className="flex items-end gap-[2px] h-8" ref={waveformRef}>
                    {Array.from({ length: WAVE_BARS }).map((_, i) => {
                      const progress = audioDuration ? audioCurrentTime / audioDuration : 0;
                      const barPos = i / WAVE_BARS;
                      const isPlayed = barPos <= progress;
                      const height = 20 + Math.sin(i * 1.5 + 1) * 10 + Math.sin(i * 0.7) * 6;
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-full transition-all duration-100 ${
                            isOwn
                              ? isPlayed ? 'bg-white' : 'bg-white/30'
                              : isPlayed ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-500'
                          }`}
                          style={{ height: `${audioPlaying && isPlayed ? height + Math.random() * 4 : height}px` }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1 px-1">
                <span className={`text-[10px] ${isOwn ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>{formatAudioTime(audioCurrentTime)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); cycleSpeed(); }}
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                    isOwn
                      ? 'text-white/70 hover:bg-white/10'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  {audioSpeed}x
                </button>
                <span className={`text-[10px] ${isOwn ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>{formatAudioTime(audioDuration)}</span>
              </div>
              <audio
                ref={audioRef}
                src={message.mediaUrl}
                onEnded={() => { setAudioPlaying(false); if (globalAudioRef === audioRef.current) globalAudioRef = null; }}
                onTimeUpdate={() => setAudioCurrentTime(audioRef.current?.currentTime || 0)}
                onLoadedMetadata={() => setAudioDuration(audioRef.current?.duration || 0)}
              />
            </div>
          ) : (
            <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {!selectMode && (
          <div className={`flex items-center justify-end gap-1 mt-1 -mb-1 ${isOwn ? 'text-white/65' : 'text-gray-400 dark:text-gray-500'}`}>
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className={`p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-black/10 ${isOwn ? 'hover:bg-white/15' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                title="Plus"
              >
                <MoreVertical className="w-3 h-3" />
              </button>
              {showMenu && (
                <div className={`absolute bottom-full mb-1 ${isOwn ? 'right-0' : 'left-0'} bg-white dark:bg-gray-700 rounded-xl shadow-xl border border-gray-200 dark:border-gray-600 py-1 min-w-[180px] z-50 overflow-hidden`}>
                  <button
                    onClick={() => { onToggleSelect(); setShowMenu(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-3 transition-colors"
                  >
                    <CheckSquare className="w-4 h-4 text-gray-500" />
                    Sélectionner
                  </button>
                  {onReply && (
                    <button
                      onClick={() => { onReply(message); setShowMenu(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-3 transition-colors"
                    >
                      <Reply className="w-4 h-4 text-gray-500" />
                      Répondre
                    </button>
                  )}
                  <button
                    onClick={() => { deleteMessage(message.conversationId, message.id, false); setShowMenu(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-3 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-gray-500" />
                    Supprimer pour moi
                  </button>
                  {isOwn && (
                    <button
                      onClick={() => { deleteMessage(message.conversationId, message.id, true); setShowMenu(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Supprimer pour tout le monde
                    </button>
                  )}
                </div>
              )}
            </div>
            <span className="text-[10px] leading-none">{new Date(message.sentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            {isOwn && <MessageStatus message={message} />}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageStatus({ message }) {
  if (message.localStatus === 'pending') {
    return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
  }
  if (message.localStatus === 'failed') {
    return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
  }
  if (message.readAt) {
    return <CheckCheck className="w-3.5 h-3.5 text-blue-300" />;
  }
  if (message.deliveredAt) {
    return <CheckCheck className="w-3.5 h-3.5" />;
  }
  return <Check className="w-3.5 h-3.5" />;
}
