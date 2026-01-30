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


Vercel does **not** support long-lived WebSockets. So you deploy the **frontend** on Vercel and the **backend** (Node + Socket.io) on a host that supports WebSockets (e.g. Railway or Render).

### 1. Deploy the backend (Railway or Render)

**Option A – Railway**

1. Push your repo to GitHub.
2. Go to [railway.app](https://railway.app), sign in, **New Project** → **Deploy from GitHub** → select your repo.
3. Set **Root Directory** to `server` (or leave blank and set **Start Command** to `node server/server.js`).
4. Add a **Start Command**: `node server/server.js` (if root is repo root) or `node server.js` (if root is `server`).
5. In **Settings** → **Networking** → **Generate Domain**. Copy the URL (e.g. `https://your-app.railway.app`).

**Option B – Render**

1. Push your repo to GitHub.
2. Go to [render.com](https://render.com), **New** → **Web Service**, connect the repo.
3. **Root Directory**: leave blank. **Build Command**: `npm install`. **Start Command**: `npm start`.
4. Create the service and copy the URL (e.g. `https://your-app.onrender.com`).

### 2. Deploy the frontend on Vercel

1. Go to [vercel.com](https://vercel.com), **Add New** → **Project**, import your GitHub repo.
2. Set **Root Directory** to `client` (so Vercel uses the `client` folder as the app root).
3. **Build Command**: leave empty (or `echo 'No build'`). **Output Directory**: leave as default.
4. In **Settings** → **Environment Variables**, add:
   - **Name**: `SOCKET_URL`  
   - **Value**: your backend URL from step 1 (e.g. `https://your-app.railway.app`), no trailing slash.
5. Deploy. Your app will be at `https://your-project.vercel.app`.

The client calls `/api/config`, which returns `SOCKET_URL`; the app then connects to that URL for Socket.io. Locally, `/api/config` is not available, so the app falls back to the current origin (your Express server).

## Known Issues / Limitations

- Single room only (all users share one canvas)
- No persistence: refreshing the page loses the drawing (new joiners get current server state)
- Cursor positions use canvas coordinate space; very different screen sizes may show cursors slightly off
- High DPI: canvas uses `devicePixelRatio` for sharpness; coordinates are in buffer pixels

## Time Spent

(Optional: fill in your total time spent on the project.)

## License

MIT
