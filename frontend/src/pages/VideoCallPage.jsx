import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { socket, connectSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Phone, User } from 'lucide-react';
import { playRingtone, stopRingtone } from '../lib/ringtone';

const VIDEO_CONSTRAINTS = {
  high: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  medium: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 20 } },
  low: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 10 } },
  audioOnly: { width: { ideal: 160 }, height: { ideal: 120 }, frameRate: { ideal: 5 } },
};

function getBandwidthTier() {
  const conn = navigator.connection;
  if (!conn) return 'high';
  const { effectiveType, downlink } = conn;
  if (effectiveType === 'slow-2g' || downlink < 0.5) return 'audioOnly';
  if (effectiveType === '2g' || downlink < 1) return 'low';
  if (effectiveType === '3g' || downlink < 3) return 'medium';
  return 'high';
}

export function VideoCallPage() {
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const storedOfferRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [qualityTier, setQualityTier] = useState(getBandwidthTier);
  const timerRef = useRef(null);
  const [otherUserName, setOtherUserName] = useState('');

  const otherUserId = searchParams.get('with');
  const isIncoming = searchParams.get('incoming') === 'true';

  function replaceVideoTrack(tier) {
    if (!peerConnectionRef.current || !localStreamRef.current) return;
    const constraints = VIDEO_CONSTRAINTS[tier] || VIDEO_CONSTRAINTS.medium;
    navigator.mediaDevices.getUserMedia({ video: constraints, audio: false }).then((newStream) => {
      const newTrack = newStream.getVideoTracks()[0];
      const oldTrack = localStreamRef.current.getVideoTracks()[0];
      if (oldTrack) {
        localStreamRef.current.removeTrack(oldTrack);
        oldTrack.stop();
      }
      localStreamRef.current.addTrack(newTrack);
      const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(newTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    }).catch(() => {});
  }

  async function createPeerConnection(stream) {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 0,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });
    peerConnectionRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc:candidate', { target: otherUserId, candidate: event.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'disconnected' || state === 'failed') {
        if (navigator.onLine) {
          pc.restartIce();
          setCallStatus('reconnecting');
        } else {
          setCallStatus('error');
        }
      }
      if (state === 'connected') setCallStatus('connected');
    };

    return pc;
  }

  useEffect(() => {
    if (!user || !otherUserId) return;
    connectSocket();

    const socketListeners = [];
    function on(event, handler) {
      socket.on(event, handler);
      socketListeners.push([event, handler]);
    }

    const initCall = async () => {
      try {
        let videoConstraints = VIDEO_CONSTRAINTS[qualityTier] || VIDEO_CONSTRAINTS.medium;
        if (qualityTier === 'audioOnly') videoConstraints = false;

        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = await createPeerConnection(stream);

        if (isIncoming) {
          setCallStatus('ringing');
          playRingtone();

          on('webrtc:offer', async ({ offer }) => {
            stopRingtone();
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc:answer', { target: otherUserId, answer });
            setCallStatus('connected');
            timerRef.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
          });

          socket.emit('call:ready', { target: otherUserId, conversationId });
        } else {
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: qualityTier !== 'audioOnly' });
          await pc.setLocalDescription(offer);
          storedOfferRef.current = offer;

          socket.emit('call:start', { target: otherUserId, conversationId });
          setCallStatus('ringing');
          playRingtone();

          on('call:ready', () => {
            stopRingtone();
            if (storedOfferRef.current) {
              socket.emit('webrtc:offer', { target: otherUserId, offer: storedOfferRef.current, conversationId });
            }
          });
        }
      } catch (err) {
        console.error('Failed to access media:', err);
        setCallStatus('error');
      }
    };

    initCall();

    on('webrtc:answer', async ({ answer }) => {
      if (peerConnectionRef.current) {
        stopRingtone();
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setCallStatus('connected');
        timerRef.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
      }
    });

    on('webrtc:candidate', async ({ candidate }) => {
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
      }
    });

    on('call:rejected', () => {
      stopRingtone();
      setCallStatus('rejected');
    });

    on('call:ended', () => {
      stopRingtone();
      endCall();
    });

    on('user:presence', ({ userId: uid, status }) => {
      if (uid === otherUserId && status === 'online') {
        setOtherUserName('');
      }
    });

    const conn = navigator.connection;
    const handleConnectionChange = () => {
      const newTier = getBandwidthTier();
      setQualityTier(newTier);
      replaceVideoTrack(newTier);
    };
    if (conn) conn.addEventListener('change', handleConnectionChange);

    return () => {
      endCall();
      if (conn) conn.removeEventListener('change', handleConnectionChange);
      socketListeners.forEach(([event, handler]) => socket.off(event, handler));
    };
  }, [user, conversationId, otherUserId, isIncoming]);

  const endCall = () => {
    stopRingtone();
    socket.emit('call:end', { target: otherUserId, conversationId });
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    clearInterval(timerRef.current);
    navigate('/chat');
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const qualityLabel = { high: 'HD', medium: 'SD', low: 'Faible', audioOnly: 'Audio seul' };

  if (callStatus === 'rejected') {
    return (
      <div className="h-screen bg-gray-900 flex flex-col items-center justify-center text-white gap-4 px-4 animate-fade-in">
        <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center">
          <PhoneOff className="w-10 h-10 text-gray-400" />
        </div>
        <p className="text-xl font-medium">Appel refusé</p>
        <button onClick={() => navigate('/chat')} className="px-6 py-2 bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors">
          Retour
        </button>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-gray-900 flex flex-col animate-fade-in">
      <div className="flex-1 relative">
        {callStatus === 'connected' || callStatus === 'reconnecting' ? (
          <>
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 w-24 h-20 sm:w-36 sm:h-28 md:w-48 md:h-36 object-cover rounded-lg shadow-lg border-2 border-white/20 dark:border-gray-700" />
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-2 sm:gap-3">
              <p className="text-xs sm:text-sm md:text-base text-white font-medium">
                {callStatus === 'connected' && formatDuration(callDuration)}
                {callStatus === 'reconnecting' && 'Reconnexion...'}
              </p>
              {callStatus === 'connected' && (
                <span className="text-[10px] sm:text-xs bg-white/20 text-white px-1.5 sm:px-2 py-0.5 rounded-full">{qualityLabel[qualityTier] || 'SD'}</span>
              )}
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white px-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-primary-600 rounded-full flex items-center justify-center mb-4">
              <User className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <p className="text-xl sm:text-2xl font-medium text-center">{otherUserName || 'Appel en cours...'}</p>
            <p className="text-sm sm:text-base text-gray-400 mt-2">{callStatus === 'ringing' ? 'Sonnerie...' : 'Connexion...'}</p>
            {callStatus !== 'ringing' && callStatus !== 'connecting' && (
              <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 sm:px-4 py-1.5 sm:py-2">
                <p className="text-xs sm:text-sm text-white font-medium">
                  {callStatus === 'error' && 'Erreur de connexion'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-gray-800 dark:bg-gray-900 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-center gap-3 sm:gap-4">
        <button
          onClick={toggleMute}
          className={`p-3 sm:p-4 rounded-full transition-all active:scale-90 ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-500'}`}
        >
          {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6 text-white" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-white" />}
        </button>
        <button onClick={endCall} className="p-3 sm:p-4 rounded-full bg-red-500 hover:bg-red-600 transition-all active:scale-90">
          <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </button>
        <button
          onClick={toggleVideo}
          className={`p-3 sm:p-4 rounded-full transition-all active:scale-90 ${isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-500'}`}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6 text-white" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6 text-white" />}
        </button>
      </div>
    </div>
  );
}
