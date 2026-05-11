/**
 * DebugConsole.jsx
 * 화면에 console.log/error/warn을 표시하는 디버그 패널
 * 
 * 사용법: App.jsx 등에서 <DebugConsole /> 추가
 * 제거: 디버깅 끝나면 import와 <DebugConsole /> 삭제
 */
import { useState, useEffect, useRef } from "react";

export default function DebugConsole() {
  const [logs, setLogs] = useState([]);
  const [visible, setVisible] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const origLog = console.log;
    const origError = console.error;
    const origWarn = console.warn;

    const addLog = (type, args) => {
      const text = args.map((a) => {
        if (typeof a === "string") return a;
        try { return JSON.stringify(a, null, 1); }
        catch { return String(a); }
      }).join(" ");

      setLogs((prev) => [...prev.slice(-80), { type, text, time: new Date().toLocaleTimeString() }]);
    };

    console.log = (...args) => { origLog(...args); addLog("log", args); };
    console.error = (...args) => { origError(...args); addLog("error", args); };
    console.warn = (...args) => { origWarn(...args); addLog("warn", args); };

    // 전역 에러도 캡처
    const onError = (e) => addLog("error", [`${e.message} (${e.filename}:${e.lineno})`]);
    window.addEventListener("error", onError);

    return () => {
      console.log = origLog;
      console.error = origError;
      console.warn = origWarn;
      window.removeEventListener("error", onError);
    };
  }, []);

  // 자동 스크롤
  useEffect(() => {
    if (scrollRef.current && visible) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, visible]);

  const colors = { log: "#ccc", error: "#ff6b6b", warn: "#ffd43b" };

  return (
    <>
      {/* 토글 버튼 — 좌하단 */}
      <button
        onClick={() => setVisible(!visible)}
        style={{
          position: "fixed", bottom: 60, left: 8, zIndex: 9999,
          width: 36, height: 36, borderRadius: "50%",
          backgroundColor: logs.some((l) => l.type === "error") ? "#ff6b6b" : "rgba(0,0,0,0.6)",
          color: "white", border: "none", fontSize: 14,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {visible ? "✕" : "🐛"}
      </button>

      {/* 로그 패널 */}
      {visible && (
        <div style={{
          position: "fixed", bottom: 100, left: 8, right: 8, zIndex: 9998,
          maxHeight: "40vh", backgroundColor: "rgba(0,0,0,0.85)",
          borderRadius: 8, overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>
          {/* 헤더 */}
          <div style={{
            padding: "6px 12px", display: "flex", justifyContent: "space-between",
            alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}>
            <span style={{ color: "#aaa", fontSize: 11 }}>Debug Console ({logs.length})</span>
            <button
              onClick={() => setLogs([])}
              style={{ color: "#aaa", fontSize: 11, background: "none", border: "none" }}
            >
              Clear
            </button>
          </div>
          {/* 로그 목록 */}
          <div ref={scrollRef} style={{ overflowY: "auto", padding: "4px 8px", flex: 1 }}>
            {logs.map((l, i) => (
              <div key={i} style={{
                fontSize: 11, lineHeight: 1.4, padding: "2px 0",
                color: colors[l.type] || "#ccc",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                wordBreak: "break-all",
              }}>
                <span style={{ color: "#666", marginRight: 4 }}>{l.time}</span>
                {l.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
