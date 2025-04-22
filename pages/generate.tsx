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

interface Section {
  title: string;
  content: string;
  questions: {
    question_text: string;
    options: string[];
  }[];
}

export default function GenerateCourse() {
  const [prompt, setPrompt] = useState("");
  const [loadingStep, setLoadingStep] = useState<"outline" | "sections" | "questions" | null>(null);
  const [outline, setOutline] = useState<string[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  // 分步產生主流程
  const handleGenerate = async () => {
    setError("");
    setOutline([]);
    setSections([]);
    setProgress(0);

    // 1. 產生大綱
    setLoadingStep("outline");
    let outlineArr: string[] = [];
    try {
      const res = await fetch("/api/generate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "產生大綱失敗");
      outlineArr = data.outline;
      setOutline(outlineArr);
    } catch (err) {
      setError(err instanceof Error ? err.message : "產生大綱失敗");
      setLoadingStep(null);
      return;
    }

    // 2. 產生每章內容
    setLoadingStep("sections");
    const sectionArr: Section[] = [];
    for (let i = 0; i < outlineArr.length; i++) {
      setProgress(i / outlineArr.length);
      try {
        const res = await fetch("/api/generate-section", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionTitle: outlineArr[i], courseTitle: prompt }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "產生章節內容失敗");
        sectionArr.push({ title: outlineArr[i], content: data.content, questions: [] });
      } catch (err) {
        setError(err instanceof Error ? err.message : `產生章節「${outlineArr[i]}」內容失敗`);
        setLoadingStep(null);
        return;
      }
      setProgress((i + 1) / outlineArr.length);
    }
    setSections(sectionArr);

    // 3. 產生每章題目
    setLoadingStep("questions");
    for (let i = 0; i < sectionArr.length; i++) {
      setProgress(i / sectionArr.length);
      try {
        const res = await fetch("/api/generate-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionTitle: sectionArr[i].title, sectionContent: sectionArr[i].content }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "產生題目失敗");
        sectionArr[i].questions = data.questions;
      } catch (err) {
        setError(err instanceof Error ? err.message : `產生章節「${sectionArr[i].title}」題目失敗`);
        setLoadingStep(null);
        return;
      }
      setProgress((i + 1) / sectionArr.length);
    }
    setSections([...sectionArr]);
    setLoadingStep(null);
    setProgress(1);
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 24, background: "#f5f7fa", minHeight: "100vh" }}>
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
          disabled={loadingStep !== null || !prompt}
          style={{
            padding: "10px 24px",
            fontSize: 18,
            background: "#1976d2",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: loadingStep !== null || !prompt ? "not-allowed" : "pointer",
            opacity: loadingStep !== null || !prompt ? 0.6 : 1
          }}
        >
          {loadingStep ? "產生中..." : "產生課程"}
        </button>
      </div>

      {/* 進度條與 loading 狀態 */}
      {loadingStep && (
        <div style={{ margin: "24px 0" }}>
          <div style={{ marginBottom: 8, color: "#1976d2", fontWeight: 500 }}>
            {loadingStep === "outline" && "正在產生課程大綱..."}
            {loadingStep === "sections" && "正在產生章節內容..."}
            {loadingStep === "questions" && "正在產生章節題目..."}
          </div>
          <div style={{
            width: "100%",
            height: 10,
            background: "#e3e3e3",
            borderRadius: 6,
            overflow: "hidden"
          }}>
            <div style={{
              width: `${Math.round(progress * 100)}%`,
              height: "100%",
              background: "#1976d2",
              transition: "width 0.3s"
            }} />
          </div>
        </div>
      )}

      {/* 錯誤訊息 */}
      {error && <div style={{
        color: "#fff",
        background: "#d32f2f",
        padding: "12px 16px",
        borderRadius: 8,
        marginTop: 16,
        fontWeight: 500
      }}>
        {error}
        <button
          onClick={handleGenerate}
          style={{
            marginLeft: 16,
            background: "#fff",
            color: "#d32f2f",
            border: "1px solid #d32f2f",
            borderRadius: 6,
            padding: "4px 12px",
            cursor: "pointer"
          }}
        >重試</button>
      </div>}

      {/* 課程內容 */}
      {sections.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ color: "#1976d2", borderBottom: "2px solid #1976d2", paddingBottom: 4 }}>{prompt}</h2>
          {sections.map((sec, idx) => (
            <div key={sec.title} style={{
              border: "1px solid #e3e3e3",
              borderRadius: 10,
              margin: "20px 0",
              padding: 20,
              background: "#fff",
              boxShadow: "0 1px 4px #0001"
            }}>
              <h3 style={{ color: "#333", marginBottom: 8 }}>{sec.title}</h3>
              <p style={{ color: "#444", marginBottom: 12 }}>{sec.content}</p>
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
      {sections.length > 0 && (
        <ChatAssistant allContent={sections.map((s) => `${s.title}\n${s.content}`).join('\n\n')} />
      )}
    </div>
  );
} 