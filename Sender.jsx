import { useState, useRef, useEffect } from "react";

const CHUNK_SIZE = 16 * 1024;

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
function getFileIcon(name) {
  const ext = name.split(".").pop().toLowerCase()
  const icons = {
    pdf: "📄", jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️",
    mp4: "🎬", mkv: "🎬", mov: "🎬", mp3: "🎵", wav: "🎵",
    zip: "🗜️", rar: "🗜️", js: "💻", py: "💻",
    html: "🌐", css: "🎨", json: "📋", txt: "📝", doc: "📝", docx: "📝",
  };
  return icons[ext] || "📁";
}

export default function Sender({ socket }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [transferred, setTransferred] = useState(0);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const peerRef = useRef(null);
  const channelRef = useRef(null);
  const fileBufferRef = useRef(null);
  const fileRef = useRef(null);
  const lastByteRef = useRef(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (!socket) return;

    socket.on("room-created", ({ roomId }) => {
      setRoomId(roomId);
      socket.roomId = roomId;
      setStatus("waiting");
    });

    socket.on("receiver-joined", async () => {
      setStatus("connected");
      await startWebRTC();
    });

    socket.on("webrtc-answer", async ({ answer }) => {
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      if (peerRef.current && candidate) {
        try { await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
      }
    });

    socket.on("peer-disconnected", ({ message }) => {
      setError(message);
      setStatus("error");
    });

    return () => {
      socket.off("room-created");
      socket.off("receiver-joined");
      socket.off("webrtc-answer");
      socket.off("ice-candidate");
      socket.off("peer-disconnected");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const startWebRTC = async () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    peerRef.current = pc;

    const channel = pc.createDataChannel("file-transfer", { ordered: true });
    channelRef.current = channel;
    channel.binaryType = "arraybuffer";

    channel.onopen = () => {
      setStatus("transferring");
      sendFile();
    };

    channel.onerror = () => {
      setError("Data channel error. Please try again.");
      setStatus("error");
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit("ice-candidate", { candidate, roomId: socket.roomId });
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc-offer", { offer, roomId: socket.roomId });
  };

  const sendFile = () => {
    const buffer = fileBufferRef.current;
    const channel = channelRef.current;
    const currentFile = fileRef.current;
    const totalSize = buffer.byteLength;

    lastByteRef.current = 0;
    lastTimeRef.current = Date.now();

    const meta = JSON.stringify({
      type: "meta",
      name: currentFile.name,
      size: totalSize,
      fileType: currentFile.type,
    });
    channel.send(meta);

    let offset = 0;

    const sendNext = () => {
      if (offset >= totalSize) {
        channel.send(JSON.stringify({ type: "done" }));
        socket.emit("transfer-complete", { roomId: socket.roomId });
        setStatus("done");
        setProgress(100);
        return;
      }

      if (channel.bufferedAmount > 1024 * 1024) {
        setTimeout(sendNext, 50);
        return;
      }

      const end = Math.min(offset + CHUNK_SIZE, totalSize);
      const chunk = buffer.slice(offset, end);
      channel.send(chunk);
      offset = end;

      const pct = Math.round((offset / totalSize) * 100);
      setProgress(pct);
      setTransferred(offset);

      const now = Date.now();
      const elapsed = (now - lastTimeRef.current) / 1000;
      if (elapsed > 0.5) {
        setSpeed((offset - lastByteRef.current) / elapsed);
        lastByteRef.current = offset;
        lastTimeRef.current = now;
      }

      setTimeout(sendNext, 0);
    };

    sendNext();
  };

  const handleFile = async (selectedFile) => {
    setFile(selectedFile);
    fileRef.current = selectedFile;
    setStatus("idle");
    setError(null);
    const buffer = await selectedFile.arrayBuffer();
    fileBufferRef.current = buffer;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const createRoom = () => {
    if (!fileRef.current || !socket) return;
    socket.emit("create-room", {
      fileInfo: { name: fileRef.current.name, size: fileRef.current.size, type: fileRef.current.type },
    });
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    if (channelRef.current) channelRef.current.close();
    if (peerRef.current) peerRef.current.close();
    setFile(null); setRoomId(null); setStatus("idle");
    setProgress(0); setSpeed(0); setTransferred(0);
    setError(null); fileBufferRef.current = null; fileRef.current = null;
  };

  const statusConfig = {
    idle: null,
    waiting: { label: "Waiting for receiver", cls: "waiting", pulse: true },
    connected: { label: "Receiver connected!", cls: "connected" },
    transferring: { label: "Transferring", cls: "transferring", pulse: true },
    done: { label: "Transfer complete", cls: "connected" },
    error: { label: "Error", cls: "error" },
  };
  const sc = statusConfig[status];

  return (
    <div className="card">
      <p className="section-title">Send a File</p>
      {error && <div className="error-msg">⚠️ {error}</div>}
      {sc && (
        <div className={`status-badge ${sc.cls}`}>
          <div className={`status-dot ${sc.pulse ? "pulse" : ""}`} />
          {sc.label}
        </div>
      )}

      {!file ? (
        <div
          className={`drop-zone ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <input type="file" onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
          <div className="drop-icon">📦</div>
          <h3>Drop your file here</h3>
          <p>or click to browse — any file, up to 50MB</p>
        </div>
      ) : (
        <div className="file-info">
          <span className="file-icon">{getFileIcon(file.name)}</span>
          <div className="file-details">
            <div className="file-name">{file.name}</div>
            <div className="file-size">{formatBytes(file.size)}</div>
          </div>
          {status === "idle" && (
            <button className="copy-btn" onClick={reset}>✕</button>
          )}
        </div>
      )}

      {roomId && (
        <div className="room-display">
          <div className="room-label">Share this Room ID</div>
          <div className="room-id mono">{roomId}</div>
          <button className="copy-btn" onClick={copyRoomId}>
            {copied ? "✓ Copied!" : "Copy ID"}
          </button>
        </div>
      )}

      {(status === "transferring" || status === "done") && (
        <div className="progress-section">
          <div className="progress-header">
            <span className="progress-label">{status === "done" ? "Complete!" : "Sending..."}</span>
            <span className="progress-pct">{progress}%</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-stats">
            <span className="stat">Sent: <span>{formatBytes(transferred)}</span></span>
            <span className="stat">Total: <span>{formatBytes(file?.size || 0)}</span></span>
            {speed > 0 && <span className="stat">Speed: <span>{formatBytes(speed)}/s</span></span>}
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="success-screen" style={{ marginTop: "1rem" }}>
          <div className="success-icon">✅</div>
          <h2>File Sent!</h2>
          <p>Transfer complete.</p>
          <button className="btn btn-outline" onClick={reset} style={{ marginTop: "1rem" }}>Send another file</button>
        </div>
      )}

      {file && status === "idle" && (
        <button className="btn btn-primary" onClick={createRoom}>Create Transfer Room →</button>
      )}
      {status === "error" && (
        <button className="btn btn-outline" onClick={reset}>Start over</button>
      )}
    </div>
  );
}



