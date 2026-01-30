/**
 * Server-side drawing state: history of strokes per room.
 * Each stroke has a unique id and userId for global undo/redo.
 */

function createDrawingStateHandlers(roomId) {
  const strokes = [];
  const redoStack = [];

  function addStroke(stroke) {
    strokes.push(stroke);
    redoStack.length = 0;
    return stroke;
  }

  function removeLastStrokeByUser(userId) {
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (strokes[i].userId === userId) {
        const removed = strokes.splice(i, 1)[0];
        redoStack.push(removed);
        return removed;
      }
    }
    return null;
  }

  function redoLastStrokeByUser(userId) {
    for (let i = redoStack.length - 1; i >= 0; i--) {
      if (redoStack[i].userId === userId) {
        const restored = redoStack.splice(i, 1)[0];
        strokes.push(restored);
        return restored;
      }
    }
    return null;
  }

  function getFullState() {
    return { strokes: [...strokes] };
  }

  return {
    addStroke,
    removeLastStrokeByUser,
    redoLastStrokeByUser,
    getFullState,
  };
}

module.exports = { createDrawingStateHandlers };
