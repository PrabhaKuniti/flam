/**
 * Core drawing logic using native Canvas 2D API.
 * Handles coordinate mapping, path rendering, and local stroke batching.
 */

(function (global) {
  const THROTTLE_MS = 16; // ~60fps for network
  const SEGMENT_BATCH_MS = 32;

  function getCanvasCoordinates(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function createCanvasController(canvasEl, callbacks) {
    const ctx = canvasEl.getContext('2d');
    let isDrawing = false;
    let lastPos = null;
    let currentStrokeId = null;
    let currentSegments = [];
    let lastEmitTime = 0;
    let animationId = null;

    function setSize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvasEl.getBoundingClientRect();
      const w = Math.floor(rect.width * dpr);
      const h = Math.floor(rect.height * dpr);
      if (canvasEl.width !== w || canvasEl.height !== h) {
        canvasEl.width = w;
        canvasEl.height = h;
        if (callbacks.onResize) callbacks.onResize();
      }
    }

    function getPos(e) {
      return getCanvasCoordinates(e, canvasEl);
    }

    function drawSegment(ctx, start, end, color, width, tool) {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = tool === 'eraser' ? '#0f0f1a' : color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawStroke(stroke) {
      const color = stroke.color || '#000';
      const width = stroke.width || 5;
      const tool = stroke.tool || 'brush';
      const segments = stroke.segments || [];
      for (const seg of segments) {
        drawSegment(ctx, seg.start, seg.end, color, width, tool);
      }
    }

    function redraw() {
      const w = canvasEl.width;
      const h = canvasEl.height;
      ctx.clearRect(0, 0, w, h);
      if (callbacks.getStrokes) {
        const strokes = callbacks.getStrokes();
        for (const s of strokes) drawStroke(s);
      }
    }

    function startStroke(pos, color, width, tool) {
      isDrawing = true;
      lastPos = pos;
      currentStrokeId = `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      currentSegments = [];
      if (callbacks.strokeStart) {
        callbacks.strokeStart({ strokeId: currentStrokeId, color, width, tool });
      }
    }

    function addSegment(pos, color, width, tool) {
      if (!lastPos) return;
      const start = { ...lastPos };
      const end = { ...pos };
      currentSegments.push({ start, end });
      drawSegment(ctx, start, end, color, width, tool);
      lastPos = end;

      const now = Date.now();
      if (now - lastEmitTime >= THROTTLE_MS && callbacks.strokeSegment) {
        lastEmitTime = now;
        callbacks.strokeSegment({
          strokeId: currentStrokeId,
          start,
          end,
          color,
          width,
          tool,
        });
      }
    }

    function endStroke(color, width, tool) {
      if (!isDrawing) return;
      isDrawing = false;
      if (callbacks.strokeEnd && currentStrokeId && currentSegments.length >= 0) {
        callbacks.strokeEnd({
          strokeId: currentStrokeId,
          color: color || '#000',
          width: width || 5,
          tool: tool || 'brush',
          segments: [...currentSegments],
        });
      }
      currentStrokeId = null;
      currentSegments = [];
      lastPos = null;
    }

    function onPointerDown(e) {
      e.preventDefault();
      setSize();
      const pos = getPos(e);
      const tool = callbacks.getTool ? callbacks.getTool() : 'brush';
      const color = callbacks.getColor ? callbacks.getColor() : '#000000';
      const width = callbacks.getStrokeWidth ? callbacks.getStrokeWidth() : 5;
      startStroke(pos, color, width, tool);
    }

    function onPointerMove(e) {
      e.preventDefault();
      const pos = getPos(e);
      if (callbacks.cursor) callbacks.cursor(pos);
      if (!isDrawing) return;
      const tool = callbacks.getTool ? callbacks.getTool() : 'brush';
      const color = callbacks.getColor ? callbacks.getColor() : '#000000';
      const width = callbacks.getStrokeWidth ? callbacks.getStrokeWidth() : 5;
      addSegment(pos, color, width, tool);
    }

    function onPointerUp(e) {
      e.preventDefault();
      const tool = callbacks.getTool ? callbacks.getTool() : 'brush';
      const color = callbacks.getColor ? callbacks.getColor() : '#000000';
      const width = callbacks.getStrokeWidth ? callbacks.getStrokeWidth() : 5;
      endStroke(color, width, tool);
    }

    function onPointerCancel(e) {
      e.preventDefault();
      endStroke();
    }

    canvasEl.addEventListener('mousedown', onPointerDown);
    canvasEl.addEventListener('mousemove', onPointerMove);
    canvasEl.addEventListener('mouseup', onPointerUp);
    canvasEl.addEventListener('mouseleave', onPointerUp);
    canvasEl.addEventListener('touchstart', onPointerDown, { passive: false });
    canvasEl.addEventListener('touchmove', onPointerMove, { passive: false });
    canvasEl.addEventListener('touchend', onPointerUp, { passive: false });
    canvasEl.addEventListener('touchcancel', onPointerCancel, { passive: false });

    window.addEventListener('resize', () => {
      setSize();
      redraw();
    });

    return {
      setSize,
      redraw,
      drawStroke,
      drawSegment,
      getCanvasCoordinates: (e) => getPos(e),
    };
  }

  global.CanvasController = createCanvasController;
  global.getCanvasCoordinates = getCanvasCoordinates;
})(typeof window !== 'undefined' ? window : this);
