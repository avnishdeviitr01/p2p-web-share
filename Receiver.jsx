import { useState, useRef, useEffect } from "react";

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function Receiver({ socket }) {
  const [roomInput, setRoomInput] = useState("");
  const [status, setStatus] = useState("idle");
  const [fileInfo, setFileInfo] = useState(null);
  const [progress, setProgress] = useState(0);
  const [received, setReceived] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [error, setError] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const peerRef = useRef(null);
  const chunksRef = useRef([]);
  const receivedBytesRef = useRef(0);
  const fileInfoRef = useRef(null);
  const lastByteRef = useRef(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (!socket) return;

    socket.on("room-joined", ({ fileInfo, roomId }) => {
      setFileInfo(fileInfo);
      socket.roomId = roomId;
      setStatus("waiting");
    });

    socket.on("webrtc-offer", async ({ offer }) => {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      peerRef.current = pc;

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit("ice-candidate", { candidate, roomId: socket.roomId });
      };

      pc.ondatachannel = ({ channel }) => {
        channel.binaryType = "arraybuffer";

        channel.onmessage = async ({ data }) => {
          if (typeof data === "string") {
            const msg = JSON.parse(data);

            if (msg.type === "meta") {
              fileInfoRef.current = { name: msg.name, size: msg.size, type: msg.fileType };
              setFileInfo({ name: msg.name, size: msg.size, type: msg.fileType });
              chunksRef.current = [];
              receivedBytesRef.current = 0;
              lastByteRef.current = 0;
              lastTimeRef.current = Date.now();
              setStatus("transferring");
              setProgress(0);
            } else if (msg.type === "done") {
              // Assemble all chunks
              const totalSize = receivedBytesRef.current;
              const totalBuffer = new Uint8Array(totalSize);
              let offset = 0;
              for (const chunk of chunksRef.current) {
                totalBuffer.set(new Uint8Array(chunk), offset);
                offset += chunk.byteLength;
              }
              // eslint-disable-next-line react-hooks/exhaustive-deps
              const info = fileInfoRef.current;
              const blob = new Blob([totalBuffer.buffer], {
                type: info?.type || "application/octet-stream",
              });
              const url = URL.createObjectURL(blob);
              setDownloadUrl(url);

              // Auto download
              const a = document.createElement("a");
              a.href = url;
              a.download = info?.name || "received-file";
              a.click();

              setStatus("done");
              setProgress(100);
            }
            return;
          }

          // Binary chunk
          chunksRef.current.push(data);
          receivedBytesRef.current += data.byteLength;

          const total = fileInfoRef.current?.size || 1;
          const pct = Math.min(100, Math.round((receivedBytesRef.current / total) * 100));
          setProgress(pct);
          setReceived(receivedBytesRef.current);

          const now = Date.now();
          const elapsed = (now - lastTimeRef.current) / 1000;
          if (elapsed > 0.5) {
            setSpeed((receivedBytesRef.current - lastByteRef.current) / elapsed);
            lastByteRef.current = receivedBytesRef.current;
            lastTimeRef.current = now;
          }
        };

        channel.onerror = () => {
          setError("Connection error. Please try again.");
          setStatus("error");
        };
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc-answer", { answer, roomId: socket.roomId });
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      if (peerRef.current && candidate) {
        try { await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
      }
    });

    socket.on("error", ({ message }) => { setError(message); setStatus("error"); });
    socket.on("peer-disconnected", ({ message }) => { setError(message); setStatus("error"); });

    return () => {
      socket.off("room-joined"); socket.off("webrtc-offer");
      socket.off("ice-candidate"); socket.off("error"); socket.off("peer-disconnected");
    };
  }, [socket]);

  const joinRoom = () => {
    const id = roomInput.trim().toUpperCase();
    if (id.length !== 6) { setError("Room ID must be 6 characters."); return; }
    setError(null);
    setStatus("joining");
    socket.emit("join-room", { roomId: id });
  };

  const reset = () => {
    if (peerRef.current) peerRef.current.close();
    setRoomInput(""); setStatus("idle"); setFileInfo(null);
    setProgress(0); setReceived(0); setSpeed(0);
    setError(null); setDownloadUrl(null);
    chunksRef.current = []; receivedBytesRef.current = 0;
  };

  const statusConfig = {
    idle: null,
    joining: { label: "Joining room...", cls: "transferring", pulse: true },
    waiting: { label: "Waiting for sender", cls: "waiting", pulse: true },
    transferring: { label: "Receiving file", cls: "transferring", pulse: true },
    done: { label: "File received!", cls: "connected" },
    error: { label: "Error", cls: "error" },
  };
  const sc = statusConfig[status];

  return (
    <div className="card">
      <p className="section-title">Receive a File</p>
      {error && <div className="error-msg">⚠️ {error}</div>}
      {sc && (
        <div className={`status-badge ${sc.cls}`}>
          <div className={`status-dot ${sc.pulse ? "pulse" : ""}`} />
          {sc.label}
        </div>
      )}

      {status === "idle" && (
        <>
          <div className="input-group">
            <label className="input-label">Enter Room ID from sender</label>
            <input
              className="room-input" type="text" placeholder="ABC123"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
              maxLength={6}
            />
          </div>
          <button className="btn btn-primary" onClick={joinRoom} disabled={roomInput.length !== 6}>
            Join Room →
          </button>
        </>
      )}

      {fileInfo && status !== "done" && (
        <>
          <hr className="divider" />
          <div className="file-info">
            <span className="file-icon">📁</span>
            <div className="file-details">
              <div className="file-name">{fileInfo.name}</div>
              <div className="file-size mono">{formatBytes(fileInfo.size)}</div>
            </div>
          </div>
        </>
      )}

      {status === "transferring" && (
        <div className="progress-section">
          <div className="progress-header">
            <span className="progress-label">Receiving...</span>
            <span className="progress-pct">{progress}%</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-stats">
            <span className="stat">Received: <span>{formatBytes(received)}</span></span>
            <span className="stat">Total: <span>{formatBytes(fileInfo?.size || 0)}</span></span>
            {speed > 0 && <span className="stat">Speed: <span>{formatBytes(speed)}/s</span></span>}
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="success-screen">
          <div className="success-icon">✅</div>
          <h2>Download Complete!</h2>
          <p>File saved to your downloads folder.</p>
          {downloadUrl && (
            <a href={downloadUrl} download={fileInfo?.name}
              className="btn btn-primary"
              style={{ display: "block", marginTop: "1rem", textDecoration: "none", textAlign: "center" }}>
              Download again
            </a>
          )}
          <button className="btn btn-outline" onClick={reset} style={{ marginTop: "0.5rem" }}>
            Receive another file
          </button>
        </div>
      )}

      {status === "error" && (
        <button className="btn btn-outline" onClick={reset}>Try again</button>
      )}
    </div>
  );
}
