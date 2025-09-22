// Simple test to verify WebSocket functionality
const io = require('socket.io-client');

const socket = io('http://localhost:8000', {
  auth: {
    token: 'test-token'
  }
});

socket.on('connect', () => {
  console.log('Connected to WebSocket server');
  
  // Join a test room
  socket.emit('join', 'test-user-123');
  
  // Test collaborative editing
  socket.emit('prompt:editing:started', { promptId: 'test-prompt-1' });
  
  setTimeout(() => {
    socket.emit('prompt:editing:stopped', { promptId: 'test-prompt-1' });
    socket.disconnect();
  }, 2000);
});

socket.on('disconnect', () => {
  console.log('Disconnected from WebSocket server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

// Listen for events
socket.on('prompt:editing:started', (data) => {
  console.log('User started editing:', data);
});

socket.on('prompt:editing:stopped', (data) => {
  console.log('User stopped editing:', data);
});

socket.on('system:status:update', (data) => {
  console.log('System status update:', data);
});

socket.on('user:activity', (data) => {
  console.log('User activity:', data);
});