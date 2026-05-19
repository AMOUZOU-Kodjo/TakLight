import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore } from '../store/chatStore';
import { api } from '../lib/api';
import { offlineQueue } from '../lib/offlineQueue';
import { compressImage } from '../lib/compressImage';
import { Send, Smile, Paperclip, Mic, X, StopCircle } from 'lucide-react';

export function MessageInput({ conversationId }) {
  const [content, setContent] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const { sendMessage, setTyping } = useChatStore();
  const inputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);

  const handleTyping = useCallback(() => {
    if (!conversationId) return;
    setTyping(conversationId, true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setTyping(conversationId, false);
    }, 2000);
  }, [conversationId, setTyping]);

  const handleInputChange = (e) => {
    setContent(e.target.value);
    handleTyping();
  };

  useEffect(() => {
    return () => {
      clearTimeout(typingTimerRef.current);
      if (conversationId) setTyping(conversationId, false);
    };
  }, [conversationId, setTyping]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    await sendMessage(conversationId, content.trim());
    setContent('');
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const processedFile = file.type.startsWith('image/') ? await compressImage(file) : file;

      if (!navigator.onLine) {
        await offlineQueue.addPendingUpload(processedFile, conversationId);
        return;
      }

      const formData = new FormData();
      formData.append('file', processedFile);
      const endpoint = processedFile.type.startsWith('image/') ? '/api/upload/image' : '/api/upload/audio';
      const { data } = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const mediaData = {
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        mediaThumbnailUrl: data.mediaThumbnailUrl || null,
      };
      await sendMessage(conversationId, '', mediaData);
    } catch (err) {
      console.error('Upload failed:', err);
      await offlineQueue.addPendingUpload(file, conversationId);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'recording.webm', { type: 'audio/webm' });

        setIsUploading(true);
        try {
          if (!navigator.onLine) {
            await offlineQueue.addPendingUpload(file, conversationId);
            return;
          }

          const formData = new FormData();
          formData.append('file', file);
          const { data } = await api.post('/api/upload/audio', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          await sendMessage(conversationId, '', {
            mediaUrl: data.mediaUrl,
            mediaType: 'audio',
          });
        } catch (err) {
          console.error('Audio upload failed:', err);
          await offlineQueue.addPendingUpload(file, conversationId);
        } finally {
          setIsUploading(false);
        }

        stream.getTracks().forEach((track) => track.stop());
        setRecordingTime(0);
        clearInterval(recordingTimerRef.current);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      clearInterval(recordingTimerRef.current);
    };
  }, []);

  return (
    <div className="border-t border-gray-200 bg-white">
      {isRecording && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-red-700">Enregistrement en cours... {formatTime(recordingTime)}</span>
          </div>
          <button
            onClick={stopRecording}
            className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
          >
            <StopCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {showEmoji && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-wrap gap-2">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setContent((prev) => prev + emoji)}
                className="text-xl hover:bg-gray-200 p-1 rounded transition-colors"
              >
                {emoji}
              </button>
            ))}
            <button
              onClick={() => setShowEmoji(false)}
              className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*,audio/*"
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isRecording}
          className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          title="Joindre un fichier"
        >
          {isUploading ? (
            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowEmoji(!showEmoji)}
          className={`p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors ${
            showEmoji ? 'text-primary-600' : 'text-gray-500'
          }`}
          title="Emojis"
        >
          <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={handleInputChange}
          placeholder="Votre message..."
          className="flex-1 input-field text-sm sm:text-base"
          maxLength={2000}
          disabled={isRecording}
        />

        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isUploading}
          className={`p-1.5 sm:p-2 rounded-full transition-colors disabled:opacity-50 ${
            isRecording
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
          title={isRecording ? 'Arrêter' : 'Enregistrer un audio'}
        >
          <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <button
          type="submit"
          disabled={!content.trim() || isRecording || isUploading}
          className="p-1.5 sm:p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Envoyer"
        >
          <Send className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </form>
    </div>
  );
}
