import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

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
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<{ [sectionIdx: number]: number }>({});
  const [selectedOption, setSelectedOption] = useState<{ [sectionIdx: number]: string | null }>({});
  const [submitted, setSubmitted] = useState<{ [sectionIdx: number]: boolean }>({});
  const [showHint, setShowHint] = useState<{ [sectionIdx: number]: boolean }>({});
  const [hint, setHint] = useState<{ [sectionIdx: number]: string | null }>({});

  // 分步產生主流程（含影片）
  const handleGenerate = async () => {
    setError("");
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
        const data = await fetchWithRetry("/api/generate-section", { sectionTitle: outlineArr[i], courseTitle: prompt });
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
        const data = await fetchWithRetry("/api/generate-video", { sectionTitle: sectionArr[i].title, sectionContent: sectionArr[i].content });
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
      try {
        const data = await fetchWithRetry("/api/generate-questions", { sectionTitle: sectionArr[i].title, sectionContent: sectionArr[i].content });
        sectionArr[i].questions = data.questions;
        sectionArr[i].error = undefined;
      } catch (err) {
        sectionArr[i].error = {
          type: "questions",
          message: err instanceof Error ? err.message : "產生題目失敗",
          retrying: true
        };
      }
      setSections([...sectionArr]);
    }
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
              {/* 標題 */}
              <h3 style={{ color: "#333", marginBottom: 8 }}>
                {sec.title || <SkeletonBlock width="40%" height={28} />}
              </h3>
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
                              style={vscDarkPlus}
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
                : loadingStep === "sections" && <SkeletonBlock width="90%" height={20} />
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
                        const data = await fetchWithRetry("/api/generate-section", { sectionTitle: sec.title, courseTitle: prompt });
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
                        const data = await fetchWithRetry("/api/generate-video", { sectionTitle: sec.title, sectionContent: sec.content });
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
              {sec.questions && sec.questions.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {(() => {
                    const qidx = currentQuestionIdx[idx] ?? 0;
                    const q = sec.questions[qidx];
                    if (!q) return null;
                    return (
                      <div>
                        <p style={{ fontWeight: 500 }}>{q.question_text}</p>
                        {q.options?.map((opt, i) => {
                          // 判斷是否為錯誤選項
                          const isSelected = selectedOption[idx] === opt;
                          const isSubmitted = submitted[idx];
                          const isCorrect = opt === q.answer;
                          const showError = isSubmitted && isSelected && !isCorrect;
                          const showSuccess = isSubmitted && isSelected && isCorrect;
                          return (
                            <label
                              key={i}
                              style={{
                                marginRight: 12,
                                display: "block",
                                background: showError ? "#ffeaea" : showSuccess ? "#eaffea" : undefined,
                                borderRadius: 6,
                                padding: "4px 8px",
                                fontWeight: showSuccess ? 700 : undefined,
                                color: showError ? "#d32f2f" : showSuccess ? "#388e3c" : undefined,
                                border: showError ? "1px solid #d32f2f" : showSuccess ? "1px solid #388e3c" : "1px solid #eee"
                              }}
                            >
                              <input
                                type="radio"
                                name={`q${idx}_${qidx}`}
                                value={opt}
                                checked={selectedOption[idx] === opt}
                                onChange={() => setSelectedOption(s => ({ ...s, [idx]: opt }))}
                                disabled={isSubmitted && isCorrect}
                                style={{ marginRight: 4 }}
                              />
                              <span style={{ display: "inline-block" }}>
                                <ReactMarkdown components={{ p: 'span' }}>{opt}</ReactMarkdown>
                              </span>
                              {showError && <span style={{ marginLeft: 8 }}>❌</span>}
                              {showSuccess && <span style={{ marginLeft: 8 }}>✅</span>}
                            </label>
                          );
                        })}
                        <button
                          onClick={() => {
                            if (selectedOption[idx] === q.answer) {
                              setSubmitted(s => ({ ...s, [idx]: true }));
                            } else {
                              // 標記這個選項已經嘗試過，並清空選擇，讓使用者必須重新選
                              setSubmitted(s => ({ ...s, [idx + "_" + selectedOption[idx]!]: true }));
                              setSelectedOption(s => ({ ...s, [idx]: null }));
                            }
                          }}
                          disabled={!selectedOption[idx] || (submitted[idx] && selectedOption[idx] === q.answer)}
                          style={{
                            marginTop: 8,
                            background: "#1976d2",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 18px",
                            fontSize: 16,
                            fontWeight: 500,
                            cursor: !selectedOption[idx] || (submitted[idx] && selectedOption[idx] === q.answer) ? "not-allowed" : "pointer",
                            opacity: !selectedOption[idx] || (submitted[idx] && selectedOption[idx] === q.answer) ? 0.6 : 1
                          }}
                        >提交</button>
                        <button
                          onClick={async () => {
                            setShowHint(h => ({ ...h, [idx]: true }));
                            if (!q.hint) {
                              const res = await fetch("/api/generate-hint", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ question: q.question_text, sectionContent: sec.content }),
                              });
                              const data = await res.json();
                              setHint(h => ({ ...h, [idx]: data.hint ?? null }));
                            } else {
                              setHint(h => ({ ...h, [idx]: q.hint ?? null }));
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
                            cursor: showHint[idx] ? "not-allowed" : "pointer",
                            opacity: showHint[idx] ? 0.6 : 1
                          }}
                          disabled={showHint[idx]}
                        >提示</button>
                        {showHint[idx] && <div style={{ color: "#1976d2", marginTop: 8 }}>{hint[idx] || q.hint}</div>}
                        {submitted[idx] && selectedOption[idx] === q.answer && (
                          <div style={{ marginTop: 8, color: "#388e3c", fontWeight: 500 }}>
                            恭喜答對了！✅
                          </div>
                        )}
                        {submitted[idx] && selectedOption[idx] === q.answer && qidx < sec.questions.length - 1 && (
                          <button
                            onClick={() => {
                              setCurrentQuestionIdx(c => ({ ...c, [idx]: qidx + 1 }));
                              setSelectedOption(s => ({ ...s, [idx]: null }));
                              setSubmitted(s => {
                                const newS = { ...s };
                                delete newS[idx];
                                Object.keys(newS).forEach(k => {
                                  if (k.startsWith(idx + "_")) delete newS[k];
                                });
                                return newS;
                              });
                              setShowHint(h => ({ ...h, [idx]: false }));
                              setHint(h => ({ ...h, [idx]: null }));
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
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
              {(!sec.questions || sec.questions.length === 0) && loadingStep === "questions" && <SkeletonBlock height={32} width="60%" />}
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