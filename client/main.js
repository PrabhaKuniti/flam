/**
 * Application entry: wires canvas, WebSocket, toolbar, and ghost cursors.
 */

(function () {
  const canvasEl = document.getElementById('canvas');
  const colorInput = document.getElementById('color');
  const strokeWidthInput = document.getElementById('strokeWidth');
  const strokeWidthValue = document.getElementById('strokeWidthValue');
  const undoBtn = document.getElementById('undo');
  const redoBtn = document.getElementById('redo');
  const usersList = document.getElementById('users');
  const toolButtons = document.querySelectorAll('.tool[data-tool]');

  let currentTool = 'brush';
  let strokes = [];
  let users = new Map();
  let myUserId = null;
  let myColor = null;
  let cursorEls = new Map();
  let canvasController = null;

  function getStrokes() {
    return strokes;
  }

  function getTool() {
    return currentTool;
  }

  function getColor() {
    return colorInput ? colorInput.value : '#000000';
  }

  function getStrokeWidth() {
    return strokeWidthInput ? parseInt(strokeWidthInput.value, 10) : 5;
  }

  function addStroke(stroke) {
    strokes.push(stroke);
  }

  function removeStrokeById(strokeId) {
    const i = strokes.findIndex((s) => s.id === strokeId);
    if (i !== -1) {
      strokes.splice(i, 1);
      return true;
    }
    return false;
  }

  function updateUsersList() {
    if (!usersList) return;
    usersList.innerHTML = '';
    users.forEach((u, id) => {
      const li = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'user-dot';
      dot.style.background = u.color;
      li.appendChild(dot);
      li.appendChild(document.createTextNode(id === myUserId ? 'You' : (u.id || id).slice(0, 6)));
      usersList.appendChild(li);
    });
  }

  function ensureCursorEl(userId, color) {
    if (!cursorEls.has(userId)) {
      const el = document.createElement('div');
      el.className = 'cursor-ghost';
      el.setAttribute('data-user', userId);
      el.style.color = color || '#888';
      el.textContent = userId === myUserId ? 'You' : userId.slice(0, 6);
      document.querySelector('.canvas-wrap').appendChild(el);
      cursorEls.set(userId, el);
    }
    return cursorEls.get(userId);
  }

  // x, y are normalized 0–1 relative to canvas
  function moveCursor(userId, x, y, color) {
    const el = ensureCursorEl(userId, color);
    if (!el || !canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    el.style.left = (x * rect.width) + 'px';
    el.style.top = (y * rect.height) + 'px';
    if (color) el.style.color = color;
  }

  function normalize(pos) {
    if (!canvasEl || !canvasEl.width || !canvasEl.height) return pos;
    return {
      x: pos.x / canvasEl.width,
      y: pos.y / canvasEl.height,
    };
  }

  function denormalize(pos) {
    if (!canvasEl || !canvasEl.width || !canvasEl.height) return pos;
    if (pos == null || typeof pos.x !== 'number' || typeof pos.y !== 'number') return pos;
    return {
      x: pos.x * canvasEl.width,
      y: pos.y * canvasEl.height,
    };
  }

  function removeCursor(userId) {
    const el = cursorEls.get(userId);
    if (el) {
      el.remove();
      cursorEls.delete(userId);
    }
  }

  function initCanvas() {
    canvasController = window.CanvasController(canvasEl, {
      getStrokes,
      getTool,
      getColor,
      getStrokeWidth,
      onResize: () => canvasController && canvasController.redraw(),
      strokeStart: (data) => {
        window.WSClient.emit('stroke_start', {
          strokeId: data.strokeId,
          color: data.color,
          width: data.width,
          tool: data.tool,
        });
      },
      strokeSegment: (data) => {
        window.WSClient.emit('stroke_segment', {
          strokeId: data.strokeId,
          start: normalize(data.start),
          end: normalize(data.end),
        });
      },
      strokeEnd: (data) => {
        const segments = (data.segments || []).map(function (seg) {
          return { start: normalize(seg.start), end: normalize(seg.end) };
        });
        addStroke({
          id: data.strokeId,
          userId: myUserId,
          color: data.color,
          width: data.width,
          tool: data.tool,
          segments: data.segments,
        });
        window.WSClient.emit('stroke_end', {
          strokeId: data.strokeId,
          color: data.color,
          width: data.width,
          tool: data.tool,
          segments: segments,
        });
        if (canvasController) canvasController.redraw();
      },
      cursor: (() => {
        let lastCursor = 0;
        const CURSOR_THROTTLE = 50;
        return (pos) => {
          const now = Date.now();
          if (now - lastCursor < CURSOR_THROTTLE) return;
          lastCursor = now;
          const n = normalize(pos);
          window.WSClient.emit('cursor', { x: n.x, y: n.y });
        };
      })(),
    });
    canvasController.setSize();
  }

  function initSocket() {
    // On Vercel, fetch backend URL from /api/config; locally use same origin
    function doConnect() {
      fetch('/api/config')
        .then(function (r) { return r.json(); })
        .then(function (data) { window.WSClient.connect(data.socketUrl || ''); })
        .catch(function () { window.WSClient.connect(''); });
    }
    doConnect();

    window.WSClient.on('joined', (data) => {
      myUserId = data.userId;
      myColor = data.color;
      const rawStrokes = (data.state && data.state.strokes) ? data.state.strokes : [];
      strokes = rawStrokes.map(function (s) {
        const segments = (s.segments || []).map(function (seg) {
          return {
            start: denormalize(seg.start),
            end: denormalize(seg.end),
          };
        });
        return {
          id: s.id,
          userId: s.userId,
          color: s.color,
          width: s.width,
          tool: s.tool || 'brush',
          segments: segments,
        };
      });
      (data.users || []).forEach((u) => users.set(u.id, u));
      updateUsersList();
      if (canvasController) canvasController.redraw();
    });

    window.WSClient.on('user_joined', (user) => {
      users.set(user.id, user);
      updateUsersList();
    });

    window.WSClient.on('user_left', (data) => {
      users.delete(data.userId);
      removeCursor(data.userId);
      updateUsersList();
    });

    window.WSClient.on('drawing_step', (data) => {
      if (!canvasController || data.userId === myUserId) return;
      const start = data.start || data.segments?.[0]?.start;
      const end = data.end || data.segments?.[0]?.end;
      if (start && end) {
        const dStart = denormalize(start);
        const dEnd = denormalize(end);
        canvasController.drawSegment(ctxFromCanvas(), dStart, dEnd, data.color || '#000', data.width || 5, data.tool || 'brush');
      }
    });

    function ctxFromCanvas() {
      return canvasEl.getContext('2d');
    }

    window.WSClient.on('stroke_start', (data) => {
      if (data.userId === myUserId) return;
      addStroke({
        id: data.strokeId,
        userId: data.userId,
        color: data.color,
        width: data.width,
        tool: data.tool || 'brush',
        segments: [],
      });
      if (canvasController) canvasController.redraw();
    });

    window.WSClient.on('stroke_segment', (data) => {
      const stroke = strokes.find((s) => s.id === data.strokeId);
      if (stroke && data.start && data.end) {
        const start = denormalize(data.start);
        const end = denormalize(data.end);
        stroke.segments = stroke.segments || [];
        stroke.segments.push({ start: start, end: end });
        if (canvasController) {
          const ctx = canvasEl.getContext('2d');
          canvasController.drawSegment(ctx, start, end, stroke.color, stroke.width, stroke.tool || 'brush');
        }
      }
    });

    window.WSClient.on('stroke_end', (data) => {
      const stroke = strokes.find((s) => s.id === data.strokeId);
      if (stroke && data.segments && data.segments.length) {
        stroke.segments = data.segments.map(function (seg) {
          return { start: denormalize(seg.start), end: denormalize(seg.end) };
        });
      }
      if (canvasController) canvasController.redraw();
    });

    window.WSClient.on('undo', (data) => {
      if (removeStrokeById(data.strokeId) && canvasController) canvasController.redraw();
    });

    window.WSClient.on('redo', (data) => {
      const segments = (data.segments || []).map(function (seg) {
        return { start: denormalize(seg.start), end: denormalize(seg.end) };
      });
      addStroke({
        id: data.strokeId,
        userId: data.userId,
        color: data.color,
        width: data.width,
        tool: data.tool || 'brush',
        segments: segments,
      });
      if (canvasController) canvasController.redraw();
    });

    window.WSClient.on('cursor', (data) => {
      if (data.userId === myUserId) return;
      moveCursor(data.userId, data.x, data.y, data.color);
    });
  }

  if (strokeWidthInput) {
    strokeWidthInput.addEventListener('input', () => {
      if (strokeWidthValue) strokeWidthValue.textContent = strokeWidthInput.value;
    });
  }

  toolButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentTool = btn.getAttribute('data-tool') || 'brush';
      toolButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  if (undoBtn) {
    undoBtn.addEventListener('click', () => window.WSClient.emit('undo'));
  }
  if (redoBtn) {
    redoBtn.addEventListener('click', () => window.WSClient.emit('redo'));
  }

  initCanvas();
  initSocket();
})();
