import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*', // Use env var for production, fallback to '*' for testing
    methods: ['GET', 'POST'],
  },
});

// Health check endpoint (useful for Railway)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Store active users
const activeUsers = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  socket.on('join', (username) => {
    console.log(`${username} joined with ID: ${socket.id}`);
    activeUsers[socket.id] = username;
    io.emit('activeUsers', Object.entries(activeUsers).map(([id, name]) => ({ id, username: name })));
  });
  
  socket.on('callUser', ({ userToCall, signalData, name }) => {
    console.log(`${name} is calling ${activeUsers[userToCall]}`);
    io.to(userToCall).emit('callIncoming', { signal: signalData });
  });
  
  socket.on('answerCall', (data) => {
    console.log(`Call answered by ${activeUsers[socket.id]}`);
    io.to(data.to).emit('callAccepted', data.signal);
  });
  
  socket.on('ice-candidate', ({ target, candidate }) => {
    io.to(target).emit('ice-candidate', { from: socket.id, candidate });
  });
  
  socket.on('endCall', ({ to }) => {
    console.log(`Call ended by ${activeUsers[socket.id]}`);
    io.to(to).emit('callEnded');
  });
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${activeUsers[socket.id]}`);
    delete activeUsers[socket.id];
    io.emit('activeUsers', Object.entries(activeUsers).map(([id, name]) => ({ id, username: name })));
  });
});

// Use Railway's assigned PORT or fallback to 3000
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});