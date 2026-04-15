import io from 'socket.io-client';

// Create socket connection
const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin
  : 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: true
});

// Add error handling
socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});

socket.on('connect', () => {
  console.log('Socket connected');
});

export default socket;