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

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle user joining a room
  socket.on('join-room', ({ roomId, username }) => {
    socket.join(roomId);
    console.log(`${username} joined room ${roomId} with ID: ${socket.id}`);

    // Notify other users in the room about the new user
    socket.to(roomId).emit('user-connected', socket.id);

    // Send the list of current users in the room to the new user
    const usersInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []).filter(
      (id) => id !== socket.id
    );
    socket.emit('current-users', usersInRoom);
  });

  // Handle WebRTC signaling
  socket.on('offer', ({ roomId, offer }) => {
    console.log(`Offer sent in room ${roomId} from ${socket.id}`);
    socket.to(roomId).emit('offer', { offer, from: socket.id });
  });

  socket.on('answer', ({ roomId, answer }) => {
    console.log(`Answer sent in room ${roomId} from ${socket.id}`);
    socket.to(roomId).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice-candidate', ({ roomId, candidate }) => {
    console.log(`ICE candidate sent in room ${roomId} from ${socket.id}`);
    socket.to(roomId).emit('ice-candidate', { candidate, from: socket.id });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    socket.broadcast.emit('user-disconnected', socket.id);
  });
});

// Use Railway's assigned PORT or fallback to 3000
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});