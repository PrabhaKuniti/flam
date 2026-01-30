/**
 * Collaborative Canvas - Express + Socket.io server
 * Serves static client files and handles WebSocket connections.
 */

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { createRoomHandlers } = require('./rooms.js');
const { createDrawingStateHandlers } = require('./drawing-state.js');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

// Serve static client files
app.use(express.static(path.join(__dirname, '..', 'client')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Default room for simplicity; rooms.js can extend to multiple rooms
const DEFAULT_ROOM = 'default';

const drawingState = createDrawingStateHandlers(DEFAULT_ROOM);
const roomHandlers = createRoomHandlers(io, DEFAULT_ROOM, drawingState);

io.on('connection', (socket) => {
  roomHandlers.handleJoin(socket);
  roomHandlers.handleDraw(socket);
  roomHandlers.handleUndo(socket);
  roomHandlers.handleRedo(socket);
  roomHandlers.handleCursor(socket);
  roomHandlers.handleDisconnect(socket);
});

server.listen(PORT, () => {
  console.log(`Collaborative Canvas server running at http://localhost:${PORT}`);
});
