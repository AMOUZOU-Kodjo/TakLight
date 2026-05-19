import { io } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || '';

export const socket = io(WS_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  timeout: 20000,
});

socket.on('connect', () => {
  console.log('WebSocket connected');
});

socket.on('disconnect', () => {
  console.log('WebSocket disconnected');
});

socket.on('connect_error', (error) => {
  console.error('WebSocket connection error:', error);
});

export function connectSocket(token) {
  if (socket.connected) {
    socket.disconnect();
  }
  socket.auth = { token };
  socket.connect();
}

export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}
