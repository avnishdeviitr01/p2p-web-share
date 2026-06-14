const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// rooms: { roomId: { sender: socketId, receiver: socketId, fileInfo: {} } }
const rooms = new Map();

// Generate unique 6-char room ID
function generateRoomId() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", rooms: rooms.size });
});

io.on("connection", (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // Sender creates a room
  socket.on("create-room", ({ fileInfo }) => {
    let roomId = generateRoomId();
    // Ensure unique room ID
    while (rooms.has(roomId)) roomId = generateRoomId();

    rooms.set(roomId, {
      sender: socket.id,
      receiver: null,
      fileInfo,
    });

    socket.join(roomId);
    socket.roomId = roomId;
    socket.role = "sender";

    console.log(`[Room] Created: ${roomId} by ${socket.id}`);
    socket.emit("room-created", { roomId, fileInfo });
  });

  // Receiver joins a room
  socket.on("join-room", ({ roomId }) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("error", { message: "Room not found. Check the Room ID." });
      return;
    }
    if (room.receiver) {
      socket.emit("error", { message: "Room is full. Transfer already in progress." });
      return;
    }

    room.receiver = socket.id;
    socket.join(roomId);
    socket.roomId = roomId;
    socket.role = "receiver";

    console.log(`[Room] ${socket.id} joined room: ${roomId}`);

    // Notify receiver about the file
    socket.emit("room-joined", { fileInfo: room.fileInfo, roomId });

    // Notify sender that receiver is ready
    io.to(room.sender).emit("receiver-joined", { receiverId: socket.id });
  });

  // WebRTC Signaling — forward offer from sender to receiver
  socket.on("webrtc-offer", ({ offer, roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.receiver) {
      io.to(room.receiver).emit("webrtc-offer", { offer });
      console.log(`[WebRTC] Offer sent in room: ${roomId}`);
    }
  });

  // WebRTC Signaling — forward answer from receiver to sender
  socket.on("webrtc-answer", ({ answer, roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.sender) {
      io.to(room.sender).emit("webrtc-answer", { answer });
      console.log(`[WebRTC] Answer sent in room: ${roomId}`);
    }
  });

  // ICE Candidates — forward to the other peer
  socket.on("ice-candidate", ({ candidate, roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const targetId =
      socket.id === room.sender ? room.receiver : room.sender;
    if (targetId) {
      io.to(targetId).emit("ice-candidate", { candidate });
    }
  });

  // Transfer complete notification
  socket.on("transfer-complete", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      io.to(roomId).emit("transfer-complete");
      console.log(`[Transfer] Complete in room: ${roomId}`);
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    const roomId = socket.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    // Notify the other peer
    if (socket.role === "sender") {
      if (room.receiver) {
        io.to(room.receiver).emit("peer-disconnected", {
          message: "Sender disconnected. Transfer cancelled.",
        });
      }
      rooms.delete(roomId);
      console.log(`[Room] Deleted: ${roomId}`);
    } else if (socket.role === "receiver") {
      io.to(room.sender).emit("peer-disconnected", {
        message: "Receiver disconnected.",
      });
      room.receiver = null;
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Signaling server running on port ${PORT}`);
});