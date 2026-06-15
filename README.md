# P2PShare — Direct Browser-to-Browser File Transfer

A real-time peer-to-peer file sharing web app built with WebRTC, React.js, and Node.js + Socket.io. Files are transferred **directly between browsers** — no server storage involved.

## 🔗 Live Links

- **Frontend:** [https://p2p-web-share-theta.vercel.app](https://p2p-web-share-theta.vercel.app)
- **Backend:** [https://p2p-web-share-xfuf.onrender.com](https://p2p-web-share-xfuf.onrender.com)
- **Demo Video:** [Watch Demo](https://drive.google.com/file/d/1UchsI1QkiOW38moQzdunbPUI7PtgKxy_/view?usp=sharing)

## ✨ Features

- 🖱️ Drag & drop file upload
- 🔑 Unique Room ID generation for secure sharing
- ⚡ Direct P2P transfer via WebRTC Data Channels
- 🔐 SHA-256 chunk verification to prevent data corruption
- 📊 Real-time progress bar (%, speed in MB/s, bytes transferred)
- ⬇️ Auto-download on file receive
- ⚠️ Graceful disconnect handling with UI notification

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js, CSS |
| Backend | Node.js, Express, Socket.io |
| P2P Transfer | WebRTC Data Channels |
| Integrity Check | Web Crypto API (SHA-256) |
| Frontend Deploy | Vercel |
| Backend Deploy | Render |

## 🚀 Getting Started Locally

### Prerequisites
- Node.js v18+

### 1. Clone the repo
```bash
git clone https://github.com/avnishdeviitr01/p2p-web-share.git
cd p2p-web-share
```

### 2. Start the signaling server
```bash
cd server
npm install
node index.js
```
Server runs on `http://localhost:3001`

### 3. Start the React frontend
```bash
cd client
npm install
npm start
```
Frontend runs on `http://localhost:3000`

### 4. Test it
1. Open two browser tabs at `http://localhost:3000`
2. **Tab 1:** Select **Send** → Drop a file → Copy the Room ID
3. **Tab 2:** Select **Receive** → Enter the Room ID → Click Join Room
4. File transfers directly between browsers!

## 🔄 How It Works

1. **Sender** drops a file and gets a unique 6-character Room ID
2. **Receiver** joins using the Room ID
3. Both peers connect via **Socket.io signaling server** (SDP + ICE exchange)
4. **WebRTC Data Channel** is established for direct P2P transfer
5. File is split into **16KB chunks**, each verified with **SHA-256 hash**
6. Receiver **auto-downloads** the file on completion

## 📁 Project Structure

```
p2p-web-share/
├── server/
│   ├── index.js          # Socket.io signaling server
│   └── package.json
├── client/
│   ├── public/
│   └── src/
│       ├── App.js         # Main app with socket connection
│       ├── index.js
│       ├── index.css
│       └── components/
│           ├── Sender.jsx    # File sender with WebRTC
│           └── Receiver.jsx  # File receiver with WebRTC
└── README.md
```

## 👨‍💻 Author

**Avnish Kumar** — [GitHub](https://github.com/avnishdeviitr01)
