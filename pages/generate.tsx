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

      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        // 不是 JSON，直接讀取文字內容
        const text = await res.text();
        setError(`API 回傳非 JSON 格式：${text}`);
        console.error("API 非 JSON 回應：", text);
        return;
      }
      if (!res.ok) {
        setError(data instanceof Error ? data.message : "API 請求失敗");
        console.error("API error detail:", data);
        return;
      }
      setCourse(data as Course);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤");
      console.error("前端錯誤：", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 24 }}>
      <h1>AI 產生課程</h1>
      <input
        type="text"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="請輸入課程主題"
        style={{ width: "80%", padding: 8, fontSize: 16 }}
      />
      <button onClick={handleGenerate} disabled={loading || !prompt} style={{ marginLeft: 8 }}>
        {loading ? "產生中..." : "產生課程"}
      </button>
      {error && <div style={{ color: "red", marginTop: 16 }}>{error}</div>}
      {course && (
        <div style={{ marginTop: 32 }}>
          <h2>{course.title}</h2>
          {course.sections?.map((sec, idx) => (
            <div key={sec.id || idx} style={{ border: "1px solid #ccc", margin: "16px 0", padding: 16 }}>
              <h3>{sec.title}</h3>
              <p>{sec.content}</p>
              {sec.youtube_url && (
                <iframe
                  width="400"
                  height="225"
                  src={`https://www.youtube.com/embed/${extractID(sec.youtube_url)}`}
                  title={sec.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ margin: "16px 0" }}
                />
              )}
              {sec.questions?.map((q, qidx) => (
                <div key={qidx} style={{ marginTop: 12 }}>
                  <p>{q.question_text}</p>
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
      {course && course.sections && (
        <ChatAssistant allContent={course.sections.map((s) => `${s.title}\n${s.content}`).join('\n\n')} />
      )}
    </div>
  );
} 