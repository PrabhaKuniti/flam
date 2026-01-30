/**
 * Room logic: join, broadcast, cursor tracking, and drawing state sync.
 */

const { randomBytes } = require('crypto');

const USER_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#e91e63', '#00bcd4',
];

function getNextColor(usedColors) {
  for (const c of USER_COLORS) {
    if (!usedColors.has(c)) return c;
  }
  return '#' + randomBytes(3).toString('hex');
}

function createRoomHandlers(io, defaultRoomId, drawingState) {
  const users = new Map();
  const usedColors = new Set();

  function handleJoin(socket) {
    const roomId = defaultRoomId;
    const userId = socket.id;
    const color = getNextColor(usedColors);
    usedColors.add(color);

    const user = { id: userId, color, roomId };
    users.set(userId, user);
    socket.join(roomId);

    socket.emit('joined', {
      userId,
      color,
      users: Array.from(users.values()),
      state: drawingState.getFullState(),
    });

    socket.to(roomId).emit('user_joined', user);
  }

  function handleDraw(socket) {
    // Live segment broadcast only (no history); full stroke stored on stroke_end
    socket.on('drawing_step', (data) => {
      const user = users.get(socket.id);
      if (!user) return;
      socket.to(user.roomId).emit('drawing_step', {
        ...data,
        userId: socket.id,
        color: data.style?.color ?? user.color,
        width: (data.style?.width ?? 5),
        tool: data.tool ?? 'brush',
      });
    });

    socket.on('stroke_start', (data) => {
      const user = users.get(socket.id);
      if (!user) return;
      socket.to(user.roomId).emit('stroke_start', {
        strokeId: data.strokeId,
        userId: socket.id,
        color: data.color ?? user.color,
        width: data.width ?? 5,
        tool: data.tool ?? 'brush',
      });
    });

    socket.on('stroke_segment', (data) => {
      const user = users.get(socket.id);
      if (!user) return;
      socket.to(user.roomId).emit('stroke_segment', {
        strokeId: data.strokeId,
        start: data.start,
        end: data.end,
      });
    });

    socket.on('stroke_end', (data) => {
      const user = users.get(socket.id);
      if (!user) return;

      const stroke = drawingState.addStroke({
        id: data.strokeId,
        userId: socket.id,
        color: data.color ?? user.color,
        width: data.width ?? 5,
        tool: data.tool ?? 'brush',
        segments: data.segments || [],
      });

      socket.to(user.roomId).emit('stroke_end', {
        strokeId: stroke.id,
        userId: socket.id,
        segments: stroke.segments,
      });
    });
  }

  function handleUndo(socket) {
    socket.on('undo', () => {
      const user = users.get(socket.id);
      if (!user) return;

      const removed = drawingState.removeLastStrokeByUser(socket.id);
      if (removed) {
        io.to(user.roomId).emit('undo', { strokeId: removed.id, userId: socket.id });
      }
    });
  }

  function handleRedo(socket) {
    socket.on('redo', () => {
      const user = users.get(socket.id);
      if (!user) return;

      const restored = drawingState.redoLastStrokeByUser(socket.id);
      if (restored) {
        io.to(user.roomId).emit('redo', {
          strokeId: restored.id,
          userId: socket.id,
          color: restored.color,
          width: restored.width,
          tool: restored.tool,
          segments: restored.segments,
        });
      }
    });
  }

  function handleCursor(socket) {
    socket.on('cursor', (pos) => {
      const user = users.get(socket.id);
      if (!user) return;
      socket.to(user.roomId).emit('cursor', { userId: socket.id, ...pos, color: user.color });
    });
  }

  function handleDisconnect(socket) {
    socket.on('disconnect', () => {
      const user = users.get(socket.id);
      if (user) {
        usedColors.delete(user.color);
        users.delete(socket.id);
        socket.to(user.roomId).emit('user_left', { userId: socket.id });
      }
    });
  }

  return {
    handleJoin,
    handleDraw,
    handleUndo,
    handleRedo,
    handleCursor,
    handleDisconnect,
  };
}

module.exports = { createRoomHandlers };
