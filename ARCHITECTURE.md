# Architecture: Collaborative Drawing Canvas

## Data Flow Diagram

```
┌─────────────────┐                    ┌─────────────────┐
│   Client A      │                    │   Server        │
│   (Canvas +     │  stroke_start      │   (Express +    │
│    Socket.io)   │ ─────────────────►│    Socket.io)   │
│                 │  stroke_segment    │                 │
│                 │ ─────────────────► │  broadcast      │
│                 │  stroke_end        │  to room        │
│                 │ ─────────────────► │                 │
│                 │  cursor (throttle) │ ───────────────►│  Client B, C…
│                 │  undo / redo      │                 │
└─────────────────┘                    └─────────────────┘
        ▲                                        │
        │  joined (full state)                    │  drawing_step
        │  stroke_start/segment/end               │  undo / redo
        │  cursor                                 │  user_joined / user_left
        └────────────────────────────────────────┘
```

- **Client → Server**: Drawing events (stroke_start, stroke_segment, stroke_end), cursor position (throttled), undo/redo.
- **Server → Clients**: Same events broadcast to other users in the room; new users get full state on `joined`.
- **Server** holds the single source of truth: list of strokes and redo stack per room.

---

## WebSocket Protocol (Socket.io)

### Client → Server (emit)

| Event            | Payload | Description |
|------------------|---------|-------------|
| (implicit join)  | —       | On connect, server adds socket to default room and sends `joined`. |
| `stroke_start`   | `{ strokeId, color, width, tool }` | Start of a new stroke. |
| `stroke_segment` | `{ strokeId, start, end }` | One path segment (throttled). |
| `stroke_end`     | `{ strokeId, color, width, tool, segments }` | End of stroke; full segments array. |
| `cursor`         | `{ x, y }` | Cursor position (throttled ~50 ms). |
| `undo`           | —       | Request to undo last stroke by this user. |
| `redo`           | —       | Request to redo last undone stroke by this user. |

### Server → Client (on)

| Event          | Payload | Description |
|----------------|---------|-------------|
| `joined`       | `{ userId, color, users[], state: { strokes } }` | After join; full canvas state for sync. |
| `user_joined`  | `{ id, color, roomId }` | Another user joined. |
| `user_left`    | `{ userId }` | User disconnected. |
| `stroke_start` | `{ strokeId, userId, color, width, tool }` | Remote user started a stroke. |
| `stroke_segment` | `{ strokeId, start, end }` | Remote user added a segment. |
| `stroke_end`   | `{ strokeId, userId, segments }` | Remote user finished a stroke. |
| `drawing_step` | (legacy) segment data | Optional live segment broadcast. |
| `undo`         | `{ strokeId, userId }` | A stroke was undone; all clients remove it. |
| `redo`         | `{ strokeId, userId, color, width, tool, segments }` | A stroke was redone; all clients add it. |
| `cursor`       | `{ userId, x, y, color }` | Remote cursor position. |

---

## Undo / Redo Strategy

- **Server** keeps:
  - `strokes`: array of strokes (each has `id`, `userId`, `color`, `width`, `tool`, `segments[]`).
  - `redoStack`: array of undone strokes (same shape).

- **Undo** (requested by user U):
  - Server finds the **last stroke in `strokes` whose `userId === U`**.
  - Removes it from `strokes` and pushes it onto `redoStack`.
  - Broadcasts `undo { strokeId, userId }` to **all** clients (including U).
  - All clients remove that stroke from local state and redraw.

- **Redo** (requested by user U):
  - Server finds the **last stroke in `redoStack` whose `userId === U`**.
  - Pops it from `redoStack` and pushes back onto `strokes`.
  - Broadcasts `redo { strokeId, userId, color, width, tool, segments }` to all clients.
  - All clients add the stroke and redraw.

- **Invariant**: Only the user who drew a stroke can undo/redo that stroke. Order of strokes is global; overlapping drawing is handled by drawing order (no pixel-level conflict resolution).

---

## Performance Decisions

1. **Path segments instead of every pixel**  
   We send `stroke_segment` (start/end) instead of every mousemove. Client throttles segment emission (~16 ms) to cap network usage while keeping lines smooth.

2. **Cursor throttling**  
   Cursor events are throttled (~50 ms) so many users don’t flood the server.

3. **Incremental drawing for remote strokes**  
   On `stroke_segment`, clients draw only the new segment instead of redrawing the whole canvas. Full redraw happens on undo/redo and on initial `joined` state.

4. **Single room, in-memory state**  
   One default room and in-memory strokes keep the demo simple. Scaling would require multiple rooms and a persistent store (e.g. Redis or DB) for state.

5. **No client-side prediction for others**  
   We don’t predict other users’ strokes; we only render what the server broadcasts. This avoids conflict resolution complexity and keeps the server as the single source of truth.

---

## Conflict Handling

- **Simultaneous drawing**: No locking. Multiple users can draw at once. Strokes are appended to the server list in the order `stroke_end` is received. Clients render in that order, so overlapping strokes are drawn one after the other (last received on top).
- **Undo/redo**: Only the author can undo/redo their stroke. No cross-user undo conflict.
- **Late join**: New clients receive full `state.strokes` in `joined` and render once; no merge logic needed.
- **Reconnection**: Socket.io reconnects automatically; reconnected clients do not get a fresh `joined` with full state in the current implementation (known limitation; could be added by re-sending state on reconnect).
