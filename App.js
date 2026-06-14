import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import Sender from "./components/Sender";
import Receiver from "./components/Receiver";
import "./index.css";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:3001";

export default function App() {
  const [mode, setMode] = useState("send"); // send | receive
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    return () => socket.disconnect();
  }, []);

  return (
    <div className="app-wrapper">
      {/* Header */}
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">⚡</div>
          <h1>P2P<span>Share</span></h1>
        </div>
        <p className="tagline">
          Direct browser-to-browser file transfer — zero server storage
        </p>
        <div style={{ marginTop: "0.4rem", fontSize: "0.7rem", color: connected ? "var(--success)" : "var(--error)" }}>
          {connected ? "● Connected to signaling server" : "○ Connecting..."}
        </div>
      </header>

      {/* Mode toggle */}
      <div className="mode-toggle">
        <button
          className={`mode-btn ${mode === "send" ? "active" : ""}`}
          onClick={() => setMode("send")}
        >
          📤 Send
        </button>
        <button
          className={`mode-btn ${mode === "receive" ? "active" : ""}`}
          onClick={() => setMode("receive")}
        >
          📥 Receive
        </button>
      </div>

      {/* Main panel */}
      {mode === "send" ? (
        <Sender socket={socketRef.current} />
      ) : (
        <Receiver socket={socketRef.current} />
      )}

      {/* How it works */}
      <div style={{
        marginTop: "2rem",
        maxWidth: "520px",
        width: "100%",
        padding: "1.25rem",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
      }}>
        <p className="section-title">How it works</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {[
            ["1", "Sender drops a file → SHA-256 hash computed locally"],
            ["2", "A unique 6-char Room ID is generated"],
            ["3", "Receiver enters Room ID → WebRTC handshake via signaling server"],
            ["4", "File streams peer-to-peer in 64KB chunks"],
            ["5", "Hash verified on arrival → auto-downloaded"],
          ].map(([n, text]) => (
            <div key={n} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
              <span style={{
                background: "var(--accent)",
                color: "white",
                borderRadius: "50%",
                width: "20px",
                height: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.7rem",
                fontWeight: "700",
                flexShrink: 0,
                marginTop: "1px",
              }}>{n}</span>
              <span style={{ fontSize: "0.8rem", color: "var(--muted)", lineHeight: "1.5" }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      <p style={{ marginTop: "1.5rem", fontSize: "0.7rem", color: "var(--muted)" }}>
        Built with WebRTC · Socket.io · React · SHA-256
      </p>
    </div>
  );
}
