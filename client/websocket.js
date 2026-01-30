/**
 * WebSocket (Socket.io) client: event listeners and emitters.
 * Handles join, draw, undo, redo, cursor, and user list.
 */

(function (global) {
  let socket = null;
  const listeners = {
    joined: [],
    userJoined: [],
    userLeft: [],
    drawingStep: [],
    strokeStart: [],
    strokeSegment: [],
    strokeEnd: [],
    undo: [],
    redo: [],
    cursor: [],
  };

  function connect(url) {
    url = url || '';
    socket = window.io ? window.io(url) : null;
    if (!socket) {
      console.error('Socket.io not loaded');
      return null;
    }

    socket.on('joined', (data) => {
      listeners.joined.forEach((fn) => fn(data));
    });

    socket.on('user_joined', (user) => {
      listeners.userJoined.forEach((fn) => fn(user));
    });

    socket.on('user_left', (data) => {
      listeners.userLeft.forEach((fn) => fn(data));
    });

    socket.on('drawing_step', (data) => {
      listeners.drawingStep.forEach((fn) => fn(data));
    });

    socket.on('stroke_start', (data) => {
      listeners.strokeStart.forEach((fn) => fn(data));
    });

    socket.on('stroke_segment', (data) => {
      listeners.strokeSegment.forEach((fn) => fn(data));
    });

    socket.on('stroke_end', (data) => {
      listeners.strokeEnd.forEach((fn) => fn(data));
    });

    socket.on('undo', (data) => {
      listeners.undo.forEach((fn) => fn(data));
    });

    socket.on('redo', (data) => {
      listeners.redo.forEach((fn) => fn(data));
    });

    socket.on('cursor', (data) => {
      listeners.cursor.forEach((fn) => fn(data));
    });

    return socket;
  }

  function on(event, fn) {
    if (listeners[event]) listeners[event].push(fn);
  }

  function emit(event, data) {
    if (socket && socket.connected) socket.emit(event, data);
  }

  function getSocket() {
    return socket;
  }

  global.WSClient = {
    connect,
    on,
    emit,
    getSocket,
  };
})(typeof window !== 'undefined' ? window : this);
