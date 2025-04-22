import { useState } from "react";
import type { Course } from "../types"; // 路徑依你的專案結構調整

function extractID(url: string) {
  // 支援多種 YouTube 連結格式
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regExp);
  return match ? match[1] : "";
}

function ChatAssistant({ allContent }: { allContent: string }) {
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setMessages(msgs => [...msgs, { role: "user", text: input }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allContent, question: input, threadId }),
      });
      const data = await res.json();
      setMessages(msgs => [
        ...msgs,
        { role: "assistant", text: `${data.answer}` }
      ]);
      if (data.threadId) setThreadId(data.threadId);
    } catch {
      setMessages(msgs => [...msgs, { role: "assistant", text: "AI 助教暫時無法回應。" }]);
    } finally {
      setInput("");
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", right: 24, top: 80, width: 320, background: "#fff",
      border: "1px solid #ccc", borderRadius: 8, padding: 16, zIndex: 1000
    }}>
      <h3>AI 助教</h3>
      <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 8 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.role === "user" ? "right" : "left", margin: "8px 0" }}>
            <span style={{ background: msg.role === "user" ? "#e0f7fa" : "#f1f8e9", padding: 6, borderRadius: 4 }}>
              {msg.text}
            </span>
          </div>
        ))}
      </div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === "Enter" && sendMessage()}
        placeholder="請輸入問題"
        style={{ width: "80%" }}
        disabled={loading}
      />
      <button onClick={sendMessage} disabled={loading || !input.trim()} style={{ marginLeft: 8 }}>
        送出
      </button>
    </div>
  );
}

export default function GenerateCourse() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setCourse(null);
    try {
      const res = await fetch("/api/generate-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      // 先判斷 content-type
      const contentType = res.headers.get("content-type");
      let data: unknown = null;
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
        if (!res.ok) {
          setError(
            typeof data === "object" && data && "error" in data
              ? (data as { error: string }).error
              : "API 請求失敗"
          );
          console.error("API error detail:", data);
          return;
        }
        setCourse(data as Course);
      } else {
        // 非 JSON，直接讀取文字內容
        const text = await res.text();
        setError(`API 回傳非 JSON 格式：${text}`);
        console.error("API 非 JSON 回應：", text);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤");
      console.error("前端錯誤：", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 24, background: "#f5f7fa", minHeight: "100vh" }}>
      {/* 標題區塊 */}
      <h1 style={{
        fontSize: 32,
        fontWeight: 700,
        color: "#1976d2",
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 8
      }}>
        <span role="img" aria-label="AI">🤖</span>
        AI 產生課程
      </h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        輸入你想學的主題，AI 幫你自動生成課程大綱、講義與練習題！
      </p>

      {/* 輸入區塊 */}
      <div style={{
        background: "#f5f7fa",
        borderRadius: 12,
        boxShadow: "0 2px 8px #0001",
        padding: 24,
        marginBottom: 24
      }}>
        <input
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="請輸入課程主題（如：AI、行銷、Python...）"
          style={{
            width: "70%",
            padding: 10,
            fontSize: 18,
            border: "1px solid #bbb",
            borderRadius: 6,
            marginRight: 12
          }}
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt}
          style={{
            padding: "10px 24px",
            fontSize: 18,
            background: "#1976d2",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: loading || !prompt ? "not-allowed" : "pointer",
            opacity: loading || !prompt ? 0.6 : 1
          }}
        >
          {loading ? "產生中..." : "產生課程"}
        </button>
      </div>

      {/* 錯誤訊息 */}
      {error && <div style={{
        color: "#fff",
        background: "#d32f2f",
        padding: "12px 16px",
        borderRadius: 8,
        marginTop: 16,
        fontWeight: 500
      }}>{error}</div>}

      {/* 課程內容 */}
      {course && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ color: "#1976d2", borderBottom: "2px solid #1976d2", paddingBottom: 4 }}>{course.title}</h2>
          {course.sections?.map((sec, idx) => (
            <div key={sec.id || idx} style={{
              border: "1px solid #e3e3e3",
              borderRadius: 10,
              margin: "20px 0",
              padding: 20,
              background: "#fff",
              boxShadow: "0 1px 4px #0001"
            }}>
              <h3 style={{ color: "#333", marginBottom: 8 }}>{sec.title}</h3>
              <p style={{ color: "#444", marginBottom: 12 }}>{sec.content}</p>
              {sec.youtube_url && (
                <iframe
                  width="400"
                  height="225"
                  src={`https://www.youtube.com/embed/${extractID(sec.youtube_url)}`}
                  title={sec.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ margin: "16px 0", borderRadius: 8, border: "1px solid #ccc" }}
                />
              )}
              {sec.questions?.map((q, qidx) => (
                <div key={qidx} style={{ marginTop: 12 }}>
                  <p style={{ fontWeight: 500 }}>{q.question_text}</p>
                  {q.options?.map((opt, i) => (
                    <label key={i} style={{ marginRight: 12 }}>
                      <input type="radio" name={`q${idx}_${qidx}`} /> {opt}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {/* AI 助教 */}
      {course && course.sections && (
        <ChatAssistant allContent={course.sections.map((s) => `${s.title}\n${s.content}`).join('\n\n')} />
      )}
    </div>
  );
} 