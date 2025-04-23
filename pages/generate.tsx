import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import atomDark from "react-syntax-highlighter/dist/esm/styles/prism/atom-dark";

async function fetchWithRetry(api: string, body: Record<string, unknown>, models = ["gpt-4.1-mini", "gpt-3.5-turbo"]) {
  let lastErr;
  for (const model of models) {
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, model }),
      });
      const data = await res.json();
      if (res.ok) return data;
      // 400 直接丟出，不 retry
      if (res.status === 400) throw new Error(data.error || "參數錯誤");
      lastErr = data.error || "API 請求失敗";
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "API 請求失敗";
    }
  }
  throw new Error(lastErr);
}

function SkeletonBlock({ height = 24, width = "100%", style = {} }: { height?: number, width?: string | number, style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-loading 1.2s infinite linear",
        borderRadius: 6,
        height,
        width,
        margin: "8px 0",
        ...style,
      }}
    />
  );
}

function BlinkingBlank({ height = 24, width = "100%", style = {} }: { height?: number, width?: string | number, style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "#fff",
        animation: "blinking-blank 1s infinite alternate",
        borderRadius: 6,
        height,
        width,
        margin: "8px 0",
        ...style,
      }}
    />
  );
}

function ChatAssistant({ allContent, targetAudience }: { allContent: string, targetAudience?: string }) {
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
        body: JSON.stringify({ allContent, question: input, threadId, targetAudience }),
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
  videoUrl?: string;
  questions: {
    question_text: string;
    options: string[];
    answer: string;
    hint?: string;
  }[];
  error?: {
    type: "section" | "video" | "questions";
    message: string;
    retrying?: boolean;
  }
}

export default function GenerateCourse() {
  const [prompt, setPrompt] = useState("");
  const [loadingStep, setLoadingStep] = useState<"outline" | "sections" | "videos" | "questions" | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<{ [sectionIdx: string]: number }>({});
  const [selectedOption, setSelectedOption] = useState<{ [sectionIdx: string]: string | null }>({});
  const [submitted, setSubmitted] = useState<{ [sectionIdx: string]: boolean }>({});
  const [showHint, setShowHint] = useState<{ [sectionIdx: string]: boolean }>({});
  const [hint, setHint] = useState<{ [sectionIdx: string]: string | null }>({});
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});
  const [numSections, setNumSections] = useState(5);
  const [targetAudience, setTargetAudience] = useState("");
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<string[]>(["multiple_choice"]); // 預設選中選擇題
  const [numQuestions, setNumQuestions] = useState(2); // 預設每章 2 題

  // 分步產生主流程（含影片）
  const handleGenerate = async () => {
    setError("");
    setSections([]);
    setProgress(0);

    // --- 新增：在開始執行前再次檢查題目型態 ---
    if (selectedQuestionTypes.length === 0) {
      setError("請至少選擇一種題目型態再產生課程。");
      setLoadingStep(null); // 確保沒有 loading 狀態殘留
      return; // 提前返回，不執行後續步驟
    }
    // --- 檢查結束 ---

    // 1. 產生大綱
    setLoadingStep("outline");
    let outlineArr: string[] = [];
    try {
      const res = await fetch("/api/generate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, numSections }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "產生大綱失敗");
      outlineArr = data.outline;
    } catch (err) {
      setError(err instanceof Error ? err.message : "產生大綱失敗");
      setLoadingStep(null);
      return;
    }

    // 2. 產生每章內容/影片/題目，逐一即時 render
    setLoadingStep("sections");
    const sectionArr: Section[] = outlineArr.map(title => ({
      title,
      content: "",
      questions: [],
      videoUrl: "",
      error: undefined
    }));
    setSections([...sectionArr]);
    for (let i = 0; i < outlineArr.length; i++) {
      setProgress(i / outlineArr.length);
      // 產生內容
      try {
        const data = await fetchWithRetry("/api/generate-section", {
          sectionTitle: outlineArr[i],
          courseTitle: prompt,
          targetAudience
        });
        sectionArr[i].content = data.content;
        sectionArr[i].error = undefined;
      } catch (err) {
        sectionArr[i].error = {
          type: "section",
          message: err instanceof Error ? err.message : "產生章節內容失敗",
          retrying: true
        };
      }
      setSections([...sectionArr]);
    }
    setLoadingStep("videos");
    for (let i = 0; i < outlineArr.length; i++) {
      setProgress(i / outlineArr.length);
      // 產生影片
      try {
        const data = await fetchWithRetry("/api/generate-video", {
          sectionTitle: sectionArr[i].title,
          sectionContent: sectionArr[i].content,
          targetAudience
        });
        sectionArr[i].videoUrl = data.videoUrl;
        sectionArr[i].error = undefined;
      } catch (err) {
        sectionArr[i].error = {
          type: "video",
          message: err instanceof Error ? err.message : "產生影片失敗",
          retrying: true
        };
      }
      setSections([...sectionArr]);
    }
    setLoadingStep("questions");
    for (let i = 0; i < outlineArr.length; i++) {
      setProgress(i / outlineArr.length);
      // 產生題目
      if (sectionArr[i].error?.type === 'section' || !sectionArr[i].content) {
          sectionArr[i].error = { // 標示題目也因內容失敗或為空而跳過
              type: "questions",
              message: sectionArr[i].error?.type === 'section'
                       ? "因章節內容產生失敗，已跳過題目產生"
                       : "因章節內容為空，已跳過題目產生",
              retrying: false // 不需要重試按鈕
          };
          setSections([...sectionArr]);
          continue; // 繼續下一個章節
      }
      try {
        const typesString = selectedQuestionTypes.join(",");
        // 加入日誌確認發送的字串
        console.log(`[Section ${i}] Sending selectedQuestionTypes: "${typesString}"`);

        const requestBody = {
          sectionTitle: sectionArr[i].title,
          sectionContent: sectionArr[i].content,
          ...(targetAudience && { targetAudience }),
          selectedQuestionTypes: typesString, // 使用變數
          numQuestions
        };
        console.log(`[Section ${i}] Generating questions with body:`, JSON.stringify(requestBody, null, 2));
        const data = await fetchWithRetry("/api/generate-questions", requestBody);
        // 確保回傳的是陣列
        sectionArr[i].questions = Array.isArray(data.questions) ? data.questions : [];
        sectionArr[i].error = undefined;
      } catch (err) {
        console.error(`[Section ${i}] Error generating questions for "${sectionArr[i].title}":`, err);
        sectionArr[i].error = {
          type: "questions",
          message: err instanceof Error ? err.message : "產生題目失敗",
          retrying: false
        };
      }
      setSections([...sectionArr]);
    }
    setLoadingStep(null);
    setProgress(1);
    // 預設展開第一個章節
    if (sectionArr.length > 0) {
      setExpandedSections({ '0': true });
    }
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
        {/* 進階設定區塊 */}
        <div style={{ display: "flex", gap: 16, marginTop: 16, marginBottom: 16, alignItems: "center" }}>
          <div>
            <label htmlFor="numSections" style={{ marginRight: 8, color: "#555" }}>章節數:</label>
            <input
              id="numSections"
              type="number"
              min="3"
              max="10"
              value={numSections}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                // 如果轉換結果不是 NaN，才更新 state
                if (!isNaN(val)) {
                  setNumSections(val);
                } else if (e.target.value === '') {
                  // 允許清空，但 state 可能需要處理空值或維持最小值
                  // 這裡暫時設為最小值 3，避免 NaN
                  setNumSections(3);
                }
              }}
              style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid #bbb", width: 60 }}
            />
          </div>
          <div>
            <label htmlFor="targetAudience" style={{ marginRight: 8, color: "#555" }}>年級:</label>
            <select
              id="targetAudience"
              value={targetAudience}
              onChange={e => setTargetAudience(e.target.value)}
              style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid #bbb", minWidth: 80 }}
            >
              <option value="">-- 請選擇 --</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(grade => (
                <option key={grade} value={String(grade)}>{grade} 年級</option>
              ))}
              <option value="other">其他</option>
            </select>
          </div>
          {/* 題數設定 */}
          <div>
            <label htmlFor="numQuestions" style={{ marginRight: 8, color: "#555" }}>每章題數:</label>
            <input
              id="numQuestions"
              type="number"
              min="1"
              max="5" // 可依需求調整上限
              value={numQuestions}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                // 如果轉換結果不是 NaN，才更新 state
                if (!isNaN(val)) {
                  setNumQuestions(val);
                } else if (e.target.value === '') {
                   // 允許清空，但 state 可能需要處理空值或維持最小值
                   // 這裡暫時設為最小值 1，避免 NaN
                  setNumQuestions(1);
                }
              }}
              style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid #bbb", width: 60 }}
            />
          </div>
        </div>
        {/* 題目型態設定 (移到下方獨立一行) */}
        <div style={{ marginTop: 8, marginBottom: 16 }}>
          <label style={{ marginRight: 16, color: "#555", fontWeight: 500 }}>題目型態:</label>
          <label htmlFor="q_mc" style={{ marginRight: 16, cursor: 'pointer' }}>
            <input
              type="checkbox"
              id="q_mc"
              value="multiple_choice"
              checked={selectedQuestionTypes.includes("multiple_choice")}
              onChange={e => {
                const value = e.target.value;
                setSelectedQuestionTypes(prev =>
                  e.target.checked ? [...prev, value] : prev.filter(t => t !== value)
                );
              }}
              style={{ marginRight: 4 }}
            />
            選擇題
          </label>
          <label htmlFor="q_tf" style={{ marginRight: 16, cursor: 'pointer' }}>
            <input
              type="checkbox"
              id="q_tf"
              value="true_false"
              checked={selectedQuestionTypes.includes("true_false")}
              onChange={e => {
                const value = e.target.value;
                setSelectedQuestionTypes(prev =>
                  e.target.checked ? [...prev, value] : prev.filter(t => t !== value)
                );
              }}
              style={{ marginRight: 4 }}
            />
            是非題
          </label>
          {/* 可以繼續加其他題型 */}
        </div>
        <button
          onClick={handleGenerate}
          disabled={loadingStep !== null || !prompt || selectedQuestionTypes.length === 0} // 確保至少選一種題型
          style={{
            padding: "10px 24px",
            fontSize: 18,
            background: "#1976d2",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: loadingStep !== null || !prompt || selectedQuestionTypes.length === 0 ? "not-allowed" : "pointer",
            opacity: loadingStep !== null || !prompt || selectedQuestionTypes.length === 0 ? 0.6 : 1
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
            {loadingStep === "videos" && "正在產生章節影片..."}
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
              {/* 標題列，點擊可展開/收合 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                  userSelect: "none",
                  marginBottom: 8
                }}
                onClick={() =>
                  setExpandedSections(s => ({
                    ...s,
                    [String(idx)]: !s[String(idx)]
                  }))
                }
              >
                <h3 style={{ color: "#333", margin: 0, flex: 1 }}>
                  {sec.title || <SkeletonBlock width="40%" height={28} />}
                </h3>
                {/* 在標題旁顯示載入狀態或錯誤提示 */}
                {loadingStep === 'sections' && !sec.content && !sec.error && <SkeletonBlock width={20} height={20} style={{ margin: 0, marginLeft: 8 }} />}
                {loadingStep === 'videos' && sec.content && !sec.videoUrl && !sec.error && <SkeletonBlock width={20} height={20} style={{ margin: 0, marginLeft: 8 }} />}
                {loadingStep === 'questions' && sec.content && (!sec.questions || sec.questions.length === 0) && !sec.error && <SkeletonBlock width={20} height={20} style={{ margin: 0, marginLeft: 8 }} />}
                {sec.error && <span style={{ color: '#d32f2f', marginLeft: 8, fontSize: 14 }}>⚠️</span>}
                <span style={{
                  fontSize: 20,
                  marginLeft: 8,
                  color: "#1976d2",
                  transition: "transform 0.2s",
                  transform: expandedSections[String(idx)] ? "rotate(90deg)" : "rotate(0deg)"
                }}>
                  ▶
                </span>
              </div>
              {/* 內容區塊，根據 expandedSections 決定是否顯示 */}
              {expandedSections[String(idx)] && (
                <>
                  {/* 內容 */}
                  {sec.content
                    ? <div style={{ color: "#444", marginBottom: 12 }}>
                        <ReactMarkdown
                          components={{
                            code(
                              props: {
                                inline?: boolean;
                                className?: string;
                                children?: React.ReactNode;
                              } & React.HTMLAttributes<HTMLElement>
                            ) {
                              const { className, children, inline, ...rest } = props;
                              const isInline = inline;
                              const match = /language-(\w+)/.exec(className || "");
                              return !isInline ? (
                                <SyntaxHighlighter
                                  style={atomDark}
                                  language={match?.[1] || "javascript"}
                                  PreTag="div"
                                  {...rest}
                                >
                                  {String(children).replace(/\n$/, "")}
                                </SyntaxHighlighter>
                              ) : (
                                <code
                                  style={{
                                    background: "#eee",
                                    borderRadius: 4,
                                    padding: "2px 4px",
                                    fontSize: 14,
                                  }}
                                  {...rest}
                                >
                                  {children}
                                </code>
                              );
                            }
                          }}
                        >
                          {sec.content}
                        </ReactMarkdown>
                      </div>
                    : loadingStep === "sections"
                      ? <BlinkingBlank width="90%" height={24} />
                      : null
                  }
                  {/* 章節內容失敗重試 */}
                  {sec.error && sec.error.type === "section" && (
                    <div style={{ color: "#d32f2f", margin: "12px 0" }}>
                      章節內容產生失敗：{sec.error.message}
                      <button
                        style={{
                          marginLeft: 12,
                          background: "#fff",
                          color: "#d32f2f",
                          border: "1px solid #d32f2f",
                          borderRadius: 6,
                          padding: "4px 12px",
                          cursor: "pointer"
                        }}
                        onClick={async () => {
                          const newSections = [...sections];
                          newSections[idx].error = {
                            type: "section",
                            message: sec.error?.message || "產生章節內容失敗",
                            retrying: true
                          };
                          setSections(newSections);
                          try {
                            const data = await fetchWithRetry("/api/generate-section", { sectionTitle: sec.title, courseTitle: prompt, targetAudience });
                            newSections[idx].content = data.content;
                            newSections[idx].error = undefined;
                            setSections([...newSections]);
                          } catch (err) {
                            newSections[idx].error = {
                              type: "section",
                              message: err instanceof Error ? err.message : "產生章節內容失敗",
                              retrying: true
                            };
                            setSections([...newSections]);
                          }
                        }}
                        disabled={sec.error.retrying}
                      >重試</button>
                      {sec.error.retrying && <span style={{ marginLeft: 8 }}>重試中...</span>}
                    </div>
                  )}
                  {/* 影片 */}
                  {sec.videoUrl
                    ? (
                      <iframe
                        width="400"
                        height="225"
                        src={sec.videoUrl.replace("watch?v=", "embed/")}
                        title={sec.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{ margin: "16px 0", borderRadius: 8, border: "1px solid #ccc" }}
                      />
                    )
                    : loadingStep === "videos" && <SkeletonBlock height={225} width={400} style={{ margin: "16px 0" }} />
                  }
                  {/* 影片失敗重試 */}
                  {sec.error && sec.error.type === "video" && (
                    <div style={{ color: "#d32f2f", margin: "12px 0" }}>
                      影片產生失敗：{sec.error.message}
                      <button
                        style={{
                          marginLeft: 12,
                          background: "#fff",
                          color: "#d32f2f",
                          border: "1px solid #d32f2f",
                          borderRadius: 6,
                          padding: "4px 12px",
                          cursor: "pointer"
                        }}
                        onClick={async () => {
                          const newSections = [...sections];
                          newSections[idx].error = {
                            type: "video",
                            message: sec.error?.message || "產生影片失敗",
                            retrying: true
                          };
                          setSections(newSections);
                          try {
                            const data = await fetchWithRetry("/api/generate-video", { sectionTitle: sec.title, sectionContent: sec.content, targetAudience });
                            newSections[idx].videoUrl = data.videoUrl;
                            newSections[idx].error = undefined;
                            setSections([...newSections]);
                          } catch (err) {
                            newSections[idx].error = {
                              type: "video",
                              message: err instanceof Error ? err.message : "產生影片失敗",
                              retrying: true
                            };
                            setSections([...newSections]);
                          }
                        }}
                        disabled={sec.error.retrying}
                      >重試</button>
                      {sec.error.retrying && <span style={{ marginLeft: 8 }}>重試中...</span>}
                    </div>
                  )}
                  {/* 題目 */}
                  {sec.content && !sec.error?.type && (
                    <>
                      {sec.questions && sec.questions.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          {(() => {
                            const qidx = currentQuestionIdx[String(idx)] ?? 0;
                            const q = sec.questions[qidx];
                            if (!q) {
                              console.error(`Question at index ${qidx} not found for section ${idx}`, sec.questions);
                              return <div style={{ color: 'red', marginTop: 12 }}>錯誤：無法載入題目 {qidx + 1}</div>;
                            }
                            return (
                              <div>
                                <p style={{ fontWeight: 500 }}>
                                  <ReactMarkdown components={{ p: 'span' }}>
                                    {`${qidx + 1}. ${q.question_text}`}
                                  </ReactMarkdown>
                                </p>
                                {/* 是非題選項 */}
                                {q.options && q.options.length === 2 && q.options.every(opt => ['是', '否', 'True', 'False', '對', '錯'].includes(opt)) ? (
                                  ['是', '否'].map((opt, i) => { // 或者用 True/False
                                    const isSelected = selectedOption[String(idx)] === opt;
                                    const isSubmitted = submitted[String(idx)];
                                    // 判斷答案時，需要處理 '是'/'True'/'對' 和 '否'/'False'/'錯' 的對應
                                    const isCorrect = (opt === '是' && ['是', 'True', '對'].includes(q.answer)) ||
                                                      (opt === '否' && ['否', 'False', '錯'].includes(q.answer));
                                    const showError = isSubmitted && isSelected && !isCorrect;
                                    const showSuccess = isSubmitted && isSelected && isCorrect;
                                    return (
                                      <label
                                        key={i}
                                        style={{
                                          marginRight: 12,
                                          display: "block", // 改為 block 讓選項垂直排列
                                          marginBottom: 8, // 增加選項間距
                                          background: showError ? "#ffeaea" : showSuccess ? "#eaffea" : "#f9f9f9",
                                          borderRadius: 6,
                                          padding: "8px 12px", // 增加內邊距
                                          fontWeight: showSuccess ? 700 : 400,
                                          color: showError ? "#d32f2f" : showSuccess ? "#388e3c" : "#333",
                                          border: showError ? "1px solid #d32f2f" : showSuccess ? "1px solid #388e3c" : "1px solid #eee",
                                          cursor: isSubmitted && isCorrect ? "default" : "pointer", // 答對後不可點
                                          transition: "background 0.2s, border 0.2s",
                                        }}
                                      >
                                        <input
                                          type="radio"
                                          name={`q${idx}_${qidx}`}
                                          value={opt}
                                          checked={isSelected}
                                          onChange={() => setSelectedOption(s => ({ ...s, [String(idx)]: opt }))}
                                          disabled={isSubmitted && isCorrect}
                                          style={{ marginRight: 8 }} // 增加選項和文字間距
                                        />
                                        <span style={{ display: "inline-block" }}>
                                          <ReactMarkdown components={{ p: 'span' }}>{opt}</ReactMarkdown>
                                        </span>
                                        {showError && <span style={{ marginLeft: 8, color: '#d32f2f' }}>❌ 錯誤</span>}
                                        {showSuccess && <span style={{ marginLeft: 8, color: '#388e3c' }}>✅ 正確</span>}
                                      </label>
                                    );
                                  })
                                ) : (
                                  /* 選擇題選項 */
                                  q.options?.map((opt, i) => {
                                    const isSelected = selectedOption[String(idx)] === opt;
                                    const isSubmitted = submitted[String(idx)];
                                    const isCorrect = opt === q.answer;
                                    const showError = isSubmitted && isSelected && !isCorrect;
                                    const showSuccess = isSubmitted && isSelected && isCorrect;
                                    return (
                                      <label
                                        key={i}
                                        style={{
                                          marginRight: 12,
                                          display: "block", // 改為 block 讓選項垂直排列
                                          marginBottom: 8, // 增加選項間距
                                          background: showError ? "#ffeaea" : showSuccess ? "#eaffea" : "#f9f9f9",
                                          borderRadius: 6,
                                          padding: "8px 12px", // 增加內邊距
                                          fontWeight: showSuccess ? 700 : 400,
                                          color: showError ? "#d32f2f" : showSuccess ? "#388e3c" : "#333",
                                          border: showError ? "1px solid #d32f2f" : showSuccess ? "1px solid #388e3c" : "1px solid #eee",
                                          cursor: isSubmitted && isCorrect ? "default" : "pointer", // 答對後不可點
                                          transition: "background 0.2s, border 0.2s",
                                        }}
                                      >
                                        <input
                                          type="radio"
                                          name={`q${idx}_${qidx}`}
                                          value={opt}
                                          checked={isSelected}
                                          onChange={() => setSelectedOption(s => ({ ...s, [String(idx)]: opt }))}
                                          disabled={isSubmitted && isCorrect}
                                          style={{ marginRight: 8 }} // 增加選項和文字間距
                                        />
                                        <span style={{ display: "inline-block" }}>
                                          <ReactMarkdown components={{ p: 'span' }}>{opt}</ReactMarkdown>
                                        </span>
                                        {showError && <span style={{ marginLeft: 8, color: '#d32f2f' }}>❌ 錯誤</span>}
                                        {showSuccess && <span style={{ marginLeft: 8, color: '#388e3c' }}>✅ 正確</span>}
                                      </label>
                                    );
                                  })
                                )}
                                {/* 提交/提示/下一題 按鈕 */}
                                <div style={{ marginTop: 16 }}>
                                  <button
                                    onClick={() => {
                                      // 判斷答案是否正確 (包含是非題的判斷)
                                      const isAnswerCorrect = (q.options?.length === 2 && q.options.every(opt => ['是', '否', 'True', 'False', '對', '錯'].includes(opt)))
                                        ? (selectedOption[String(idx)] === '是' && ['是', 'True', '對'].includes(q.answer)) ||
                                          (selectedOption[String(idx)] === '否' && ['否', 'False', '錯'].includes(q.answer))
                                        : selectedOption[String(idx)] === q.answer;

                                      if (isAnswerCorrect) {
                                        setSubmitted(s => ({ ...s, [String(idx)]: true }));
                                      } else {
                                        // 標記這個選項已經嘗試過，並清空選擇，讓使用者必須重新選
                                        setSubmitted(s => ({ ...s, [String(idx) + "_" + selectedOption[String(idx)]!]: true }));
                                        setSelectedOption(s => ({ ...s, [String(idx)]: null }));
                                      }
                                    }}
                                    disabled={!selectedOption[String(idx)] || (submitted[String(idx)])} // 只要提交過就 disable (無論對錯)，直到下一題
                                    style={{
                                      marginTop: 8,
                                      background: "#1976d2",
                                      color: "#fff",
                                      border: "none",
                                      borderRadius: 6,
                                      padding: "6px 18px",
                                      fontSize: 16,
                                      fontWeight: 500,
                                      cursor: !selectedOption[String(idx)] || (submitted[String(idx)]) ? "not-allowed" : "pointer",
                                      opacity: !selectedOption[String(idx)] || (submitted[String(idx)]) ? 0.6 : 1
                                    }}
                                  >提交</button>
                                  <button
                                    onClick={async () => {
                                      setShowHint(h => ({ ...h, [String(idx)]: true }));
                                      if (!q.hint) {
                                        const res = await fetch("/api/generate-hint", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            question: q.question_text,
                                            sectionContent: sec.content,
                                            targetAudience
                                          }),
                                        });
                                        const data = await res.json();
                                        setHint(h => ({ ...h, [String(idx)]: data.hint ?? null }));
                                      } else {
                                        setHint(h => ({ ...h, [String(idx)]: q.hint ?? null }));
                                      }
                                    }}
                                    style={{
                                      marginLeft: 8,
                                      background: "#fff",
                                      color: "#1976d2",
                                      border: "1px solid #1976d2",
                                      borderRadius: 6,
                                      padding: "6px 18px",
                                      fontSize: 16,
                                      fontWeight: 500,
                                      cursor: showHint[String(idx)] ? "not-allowed" : "pointer",
                                      opacity: showHint[String(idx)] ? 0.6 : 1
                                    }}
                                    disabled={showHint[String(idx)]}
                                  >提示</button>
                                  {/* 只有在答對時才顯示下一題按鈕 */}
                                  {submitted[String(idx)] && selectedOption[String(idx)] && (
                                    ( (q.options?.length === 2 && q.options.every(opt => ['是', '否', 'True', 'False', '對', '錯'].includes(opt)))
                                      ? (selectedOption[String(idx)] === '是' && ['是', 'True', '對'].includes(q.answer)) || (selectedOption[String(idx)] === '否' && ['否', 'False', '錯'].includes(q.answer))
                                      : selectedOption[String(idx)] === q.answer
                                    ) && qidx < sec.questions.length - 1 && (
                                      <button
                                        onClick={() => {
                                          setCurrentQuestionIdx(c => ({ ...c, [String(idx)]: qidx + 1 }));
                                          setSelectedOption(s => ({ ...s, [String(idx)]: null }));
                                          setSubmitted(s => {
                                            const newS = { ...s };
                                            delete newS[String(idx)];
                                            Object.keys(newS).forEach((k: string) => {
                                              if (k.startsWith(String(idx) + "_")) delete newS[k];
                                            });
                                            return newS;
                                          });
                                          setShowHint(h => ({ ...h, [String(idx)]: false }));
                                          setHint(h => ({ ...h, [String(idx)]: null }));
                                        }}
                                        style={{
                                          marginTop: 8,
                                          background: "#388e3c",
                                          color: "#fff",
                                          border: "none",
                                          borderRadius: 6,
                                          padding: "6px 18px",
                                          fontSize: 16,
                                          fontWeight: 500,
                                          cursor: "pointer"
                                        }}
                                      >下一題</button>
                                    )
                                  )}
                                </div>
                                {showHint[String(idx)] && <div style={{ color: "#1976d2", marginTop: 8, background: '#e3f2fd', padding: '8px 12px', borderRadius: 6 }}><strong>提示：</strong>{hint[String(idx)] || q.hint}</div>}
                                {/* 答對提示 */}
                                {submitted[String(idx)] && selectedOption[String(idx)] && (
                                  ( (q.options?.length === 2 && q.options.every(opt => ['是', '否', 'True', 'False', '對', '錯'].includes(opt)))
                                    ? (selectedOption[String(idx)] === '是' && ['是', 'True', '對'].includes(q.answer)) || (selectedOption[String(idx)] === '否' && ['否', 'False', '錯'].includes(q.answer))
                                    : selectedOption[String(idx)] === q.answer
                                  ) && (
                                    <div style={{ marginTop: 12, color: "#388e3c", fontWeight: 500, background: '#e8f5e9', padding: '8px 12px', borderRadius: 6 }}>
                                      恭喜答對了！✅
                                      {qidx === sec.questions.length - 1 && <span> (本章結束)</span>}
                                    </div>
                                  )
                                )}
                                {/* 答錯提示 */}
                                {submitted[String(idx)] && selectedOption[String(idx)] && !(
                                  ( (q.options?.length === 2 && q.options.every(opt => ['是', '否', 'True', 'False', '對', '錯'].includes(opt)))
                                    ? (selectedOption[String(idx)] === '是' && ['是', 'True', '對'].includes(q.answer)) || (selectedOption[String(idx)] === '否' && ['否', 'False', '錯'].includes(q.answer))
                                    : selectedOption[String(idx)] === q.answer
                                  )
                                ) && (
                                  <div style={{ marginTop: 12, color: "#d32f2f", fontWeight: 500, background: '#ffebee', padding: '8px 12px', borderRadius: 6 }}>
                                    答錯了，請再試一次或查看提示。❌
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* 題目載入失敗重試 */}
                      {sec.error && sec.error.type === "questions" && (
                        <div style={{ color: "#d32f2f", margin: "12px 0", background: '#ffebee', padding: '8px 12px', borderRadius: 6 }}>
                          題目產生失敗：{sec.error.message}
                          {/* 只有在非因內容失敗/為空導致時才顯示重試按鈕 */}
                          {sec.error.message !== "因章節內容產生失敗，已跳過題目產生" &&
                           sec.error.message !== "因章節內容為空，已跳過題目產生" && (
                            <button
                              style={{
                                marginLeft: 12,
                                background: "#fff",
                                color: "#d32f2f",
                                border: "1px solid #d32f2f",
                                borderRadius: 6,
                                padding: "4px 12px",
                                cursor: "pointer"
                              }}
                              onClick={async () => {
                                // --- 開始檢查 ---
                                if (!sec.content) {
                                  console.error("Cannot retry question generation: section content is empty.");
                                  // 可以選擇更新錯誤訊息提示使用者先解決內容問題
                                  const newSections = [...sections];
                                  newSections[idx].error = {
                                    type: "questions",
                                    message: "無法重試：章節內容為空",
                                    retrying: false
                                  };
                                  setSections(newSections);
                                  return; // 不執行 API 呼叫
                                }
                                // --- 檢查結束 ---

                                const newSections = [...sections];
                                newSections[idx].error = {
                                  type: "questions",
                                  message: sec.error?.message || "產生題目失敗",
                                  retrying: true
                                };
                                setSections(newSections);
                                try {
                                  const requestBody = {
                                    sectionTitle: sec.title,
                                    sectionContent: sec.content,
                                    ...(targetAudience && { targetAudience }),
                                    selectedQuestionTypes: selectedQuestionTypes.join(","),
                                    numQuestions
                                  };
                                  console.log(`[Section ${idx}] Retrying questions with body:`, JSON.stringify(requestBody, null, 2));
                                  const data = await fetchWithRetry("/api/generate-questions", requestBody);

                                  newSections[idx].questions = Array.isArray(data.questions) ? data.questions : [];
                                  newSections[idx].error = undefined;
                                  setSections([...newSections]);
                                } catch (err) {
                                  console.error(`[Section ${idx}] Error retrying questions for "${sec.title}":`, err);
                                  newSections[idx].error = {
                                    type: "questions",
                                    message: err instanceof Error ? err.message : "產生題目失敗",
                                    retrying: false
                                  };
                                  setSections([...newSections]);
                                }
                              }}
                              disabled={sec.error.retrying || !sec.content} // 如果內容為空也禁用重試
                            >重試</button>
                          )}
                          {sec.error.retrying && <span style={{ marginLeft: 8 }}>重試中...</span>}
                        </div>
                      )}

                      {/* 骨架屏: 只有在 loadingStep 是 'questions' 且 questions 尚未載入且沒有錯誤時顯示 */}
                      {loadingStep === "questions" && (!sec.questions || sec.questions.length === 0) && !sec.error && <SkeletonBlock height={80} width="80%" style={{ marginTop: 12 }} />}
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {/* AI 助教 */}
      {sections.length > 0 && (
        <ChatAssistant
          allContent={sections.map((s) => `${s.title}\n${s.content}`).join('\n\n')}
          targetAudience={targetAudience}
        />
      )}
      {/* 將 style 標籤移到這裡 */}
      <style jsx global>{`
        @keyframes blinking-blank {
          0% { opacity: 0.3; }
          100% { opacity: 1; }
        }
        @keyframes skeleton-loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
} 