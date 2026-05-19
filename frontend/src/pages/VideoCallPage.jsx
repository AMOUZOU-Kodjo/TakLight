import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { socket, connectSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';

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
  const { user } = useAuthStore();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [qualityTier, setQualityTier] = useState(getBandwidthTier);
  const timerRef = useRef(null);

  const otherUserId = searchParams.get('with');

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
      if (sender) {
        sender.replaceTrack(newTrack);
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }).catch(() => {});
  }

  useEffect(() => {
    if (!user) return;
    connectSocket(user.id);

    const initCall = async () => {
      try {
        let videoConstraints = VIDEO_CONSTRAINTS[qualityTier] || VIDEO_CONSTRAINTS.medium;
        if (qualityTier === 'audioOnly') {
          videoConstraints = false;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
          iceCandidatePoolSize: 0,
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require',
        });
        peerConnectionRef.current = peerConnection;

        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track);
        });

        peerConnection.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('webrtc:candidate', {
              target: otherUserId,
              candidate: event.candidate,
            });
          }
        };

        peerConnection.oniceconnectionstatechange = () => {
          const state = peerConnection.iceConnectionState;
          if (state === 'disconnected' || state === 'failed') {
            if (navigator.onLine) {
              peerConnection.restartIce();
              setCallStatus('reconnecting');
            } else {
              setCallStatus('error');
            }
          }
          if (state === 'connected') {
            setCallStatus('connected');
          }
        };

        const offer = await peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: qualityTier !== 'audioOnly',
        });
        await peerConnection.setLocalDescription(offer);

        socket.emit('webrtc:offer', {
          target: otherUserId,
          offer,
          conversationId,
        });

        setCallStatus('ringing');
      } catch (err) {
        console.error('Failed to access media:', err);
        setCallStatus('error');
      }
    };

    socket.on('webrtc:offer', async ({ offer, from }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        socket.emit('webrtc:answer', { target: from, answer });
      }
    });

    socket.on('webrtc:answer', async ({ answer }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setCallStatus('connected');
        timerRef.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
      }
    });

    socket.on('webrtc:candidate', async ({ candidate }) => {
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
      }
    });

    initCall();

    const conn = navigator.connection;
    const handleConnectionChange = () => {
      const newTier = getBandwidthTier();
      setQualityTier(newTier);
      replaceVideoTrack(newTier);
    };
    if (conn) {
      conn.addEventListener('change', handleConnectionChange);
    }

    return () => {
      endCall();
      if (conn) conn.removeEventListener('change', handleConnectionChange);
    };
  }, [user, conversationId, otherUserId]);

  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    clearInterval(timerRef.current);
    socket.disconnect();
    window.close();
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

  const qualityLabel = {
    high: 'HD',
    medium: 'SD',
    low: 'Faible',
    audioOnly: 'Audio seul',
  };

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      <div className="flex-1 relative">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-4 right-4 w-48 h-36 object-cover rounded-lg shadow-lg border-2 border-white/20"
        />
      </div>

      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-3">
        <p className="text-white font-medium">
          {callStatus === 'connecting' && 'Connexion...'}
          {callStatus === 'ringing' && 'Appel en cours...'}
          {callStatus === 'connected' && formatDuration(callDuration)}
          {callStatus === 'reconnecting' && 'Reconnexion...'}
          {callStatus === 'error' && 'Erreur de connexion'}
        </p>
        {callStatus === 'connected' && (
          <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
            {qualityLabel[qualityTier] || 'SD'}
          </span>
        )}
      </div>

      <div className="bg-gray-800 px-6 py-4 flex items-center justify-center gap-4">
        <button
          onClick={toggleMute}
          className={`p-4 rounded-full transition-colors ${
            isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
        </button>

        <button
          onClick={endCall}
          className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
        >
          <PhoneOff className="w-6 h-6 text-white" />
        </button>

        <button
          onClick={toggleVideo}
          className={`p-4 rounded-full transition-colors ${
            isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          {isVideoOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />}
        </button>
      </div>
    </div>
  );
}
