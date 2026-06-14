# P2P Web Share — Direct Browser-to-Browser File Transfer

A real-time peer-to-peer file sharing app built with WebRTC, React, and Node.js + Socket.io. Files are transferred directly between browsers — no server storage involved.

## Live Demo

- **Frontend:
- **Backend:** 

## Features

- Drag & drop file upload
- Unique Room ID generation for secure sharing
- Direct P2P transfer via WebRTC Data Channels
- SHA-256 chunk verification to prevent data corruption
- Real-time progress bar (%, speed in MB/s)
- Auto-download on receive
- Graceful disconnect handling

## Tech Stack

- **Frontend:** React.js, Tailwind CSS
- **Backend:** Node.js, Express, Socket.io
- **P2P:** WebRTC Data Channels
- **Hashing:** Web Crypto API (SHA-256)

## Getting Started

### Prerequisites
- Node.js v18+

### Run Locally

**1. Clone the repo**
```bash
git clone https://github.com/avnishdeviitr01/p2p-web-share.git
cd p2p-web-share
```

**2. Start the signaling server**
```bash
cd server
npm install
node index.js
```

**3. Start the React frontend**
```bash
cd client
npm install
npm start
```

**4. Open in browser**

Open two tabs at `http://localhost:3000`
- Tab 1: Select **Send**, drop a file, copy the Room ID
- Tab 2: Select **Receive**, enter the Room ID, click Join

## How It Works

1. Sender drops a file and gets a unique Room ID
2. Both peers connect via Socket.io signaling server
3. WebRTC connection is established (ICE + SDP exchange)
4. File is split into chunks, each verified with SHA-256
5. Receiver auto-downloads the file on completion

## Project Structure

```
p2p-web-share/
├── server/
│   ├── index.js         # Socket.io signaling server
│   └── package.json
├── client/
│   ├── public/
│   └── src/
│       ├── App.js
│       ├── components/
│       │   ├── Sender.jsx
│       │   └── Receiver.jsx
│       └── index.js
└── README.md
```
