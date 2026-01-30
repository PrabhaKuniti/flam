# Real-Time Collaborative Drawing Canvas

A multi-user drawing application where multiple people can draw simultaneously on a shared canvas. Built with the native HTML5 Canvas API, Node.js, and Socket.io. No drawing libraries (e.g. Fabric.js or Konva) are used.

## Features

- **Drawing tools**: Brush, Eraser, multiple colors, adjustable stroke width
- **Real-time sync**: Drawings appear on all clients while drawing (path segments streamed)
- **User indicators**: Ghost cursors show where other users are; online user list with unique colors
- **Global Undo/Redo**: Undo removes your last stroke; redo restores it; state synced across all clients
- **Conflict handling**: Server is source of truth; strokes are ordered; overlapping drawing is rendered in order

## Requirements

- Node.js v18 or higher
- npm or yarn

## Install and Run

```bash
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

## Testing with Multiple Users

1. Start the server: `npm start`
2. Open **http://localhost:3000** in two or more browser windows (or different devices on the same network)
3. Draw in one window — strokes and cursor should appear in the others in real time
4. Use **Undo** in one window — your last stroke should disappear for everyone
5. Use **Redo** — the stroke should reappear for everyone

## Project Structure

```
collaborative-canvas/
├── client/
│   ├── index.html       # Main UI
│   ├── style.css        # Layout and canvas styling
│   ├── canvas.js        # Canvas 2D drawing and coordinate handling
│   ├── websocket.js     # Socket.io event listeners and emitters
│   └── main.js          # Entry point, wires canvas + socket + toolbar
├── server/
│   ├── server.js        # Express + Socket.io server
│   ├── rooms.js         # Join, broadcast, cursor, draw, undo/redo handlers
│   └── drawing-state.js # Server-side stroke history and undo/redo stacks
├── package.json
├── README.md
└── ARCHITECTURE.md      # Data flow, protocol, undo strategy, performance
```

## Known Issues / Limitations

- Single room only (all users share one canvas)
- No persistence: refreshing the page loses the drawing (new joiners get current server state)
- Cursor positions use canvas coordinate space; very different screen sizes may show cursors slightly off
- High DPI: canvas uses `devicePixelRatio` for sharpness; coordinates are in buffer pixels

## Time Spent

(Optional: fill in your total time spent on the project.)

## License

MIT
