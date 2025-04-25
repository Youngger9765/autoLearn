import { useState, Fragment, CSSProperties, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import atomDark from "react-syntax-highlighter/dist/esm/styles/prism/atom-dark";
import remarkGfm from 'remark-gfm';
import axios from "axios";
import Image from 'next/image';
import dynamic from "next/dynamic";
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

// 臨時型別定義（請根據實際情況調整）
type Question = {
  question_text: string;
  options: string[];
  answer: string;
  hint?: string;
};
type Section = {
  title: string;
  content: string;
  questions: Question[];
  videoUrl: string;
  error?: {
    type: string;
    message: string;
    retrying: boolean;
  };
};

// --- Helper Functions & Components (使用內聯樣式) ---

// 修改 fetchWithRetry 回傳型別並處理錯誤回傳
async function fetchWithRetry<T>(url: string, body: unknown, retries = 2, delay = 1000): Promise<{ data: T | null; error: Error | null }> {
  let lastError: Error | null = null;

  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP error ${res.status}` }));
        // 建立錯誤物件，但不立即拋出
        lastError = new Error(errorData.error || `請求失敗，狀態碼: ${res.status}`);
        if (i === retries) {
           // 如果是最後一次嘗試，跳出迴圈，稍後回傳錯誤
           break;
        }
        // 等待並重試
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        continue; // 進入下一次迴圈
      }

      // 請求成功
      const data = await res.json();
      return { data: data as T, error: null }; // 回傳成功結果

    } catch (err) {
      // 捕捉網路錯誤或其他 fetch 期間的錯誤
      lastError = err instanceof Error ? err : new Error("請求過程中發生未知錯誤");
      console.error(`Attempt ${i + 1} failed for ${url}:`, lastError);
      if (i === retries) {
        // 如果是最後一次嘗試，跳出迴圈
        break;
      }
      // 等待並重試
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }

  // 如果迴圈結束仍未成功回傳，表示所有重試都失敗了
  // 回傳最後捕捉到的錯誤
  return { data: null, error: lastError ?? new Error("重試次數已用盡，但未捕獲到具體錯誤") };
}

// 骨架屏元件 (使用內聯樣式和 style jsx)
function SkeletonBlock({ height = 24, width = "100%", style = {} }: { height?: number | string, width?: string | number, style?: CSSProperties }) {
  return (
    <>
      <div
        className="skeleton-block" // 使用 class name 配合 style jsx
        style={{ height, width, ...style }}
      />
      {/* style jsx 放在父元件或全域 */}
    </>
  );
}

// AI 助教元件 (使用內聯樣式)
function ChatAssistant({ allContent, targetAudience, onClose }: { allContent: string, targetAudience: string, onClose?: () => void }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = { role: 'user' as const, text: input };
    setMessages(msgs => [...msgs, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post("/api/chat", {
        allContent,
        question: input,
        threadId,
        targetAudience,
      });
      const data = res.data;

      setMessages(msgs => [
        ...msgs,
        { role: "assistant", text: `${data.answer}` }
      ]);
      if (data.threadId) setThreadId(data.threadId);
    } catch (err) {
       setMessages(msgs => [
        ...msgs,
        { role: "assistant", text: `抱歉，發生錯誤：${err instanceof Error ? err.message : '未知錯誤'}` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // AI 助教區樣式
  const assistantStyle: CSSProperties = {
    position: 'fixed',
    top: '5rem', // 距離頂部距離
    right: '1.5rem', // 距離右側距離
    width: '320px', // 固定寬度
    backgroundColor: '#ffffff',
    borderRadius: '0.5rem', // 圓角
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', // 陰影
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 7rem)', // 計算高度以填滿空間
    zIndex: 50,
    border: '1px solid #e5e7eb', // 邊框
  };

  const messagesContainerStyle: CSSProperties = {
    flexGrow: 1,
    overflowY: 'auto',
    marginBottom: '0.75rem',
    paddingRight: '0.5rem', // 留出滾動條空間
  };

  const inputAreaStyle: CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid #e5e7eb',
  };

  const inputStyle: CSSProperties = {
    flexGrow: 1,
    padding: '0.5rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
  };

  const buttonStyle: CSSProperties = {
    backgroundColor: '#2563eb', // 藍色背景
    color: 'white',
    fontWeight: 600,
    padding: '0.5rem 1rem',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  };

  const disabledButtonStyle: CSSProperties = {
    ...buttonStyle,
    opacity: 0.5,
    cursor: 'not-allowed',
  };

  return (
    <div style={assistantStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1f2937', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', margin: 0 }}>
          AI 助教
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              color: '#6b7280',
              cursor: 'pointer',
              marginLeft: '0.5rem',
            }}
            title="關閉"
          >✖️</button>
        )}
      </div>
      <div style={messagesContainerStyle}>
        {messages.length === 0 && !loading && (
          <p style={{ fontSize: '0.875rem', color: '#6b7280', textAlign: 'center', marginTop: '1rem' }}>請輸入問題與我互動</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '0.75rem' }}>
            <div
              style={{
                padding: '0.5rem',
                borderRadius: '0.5rem',
                maxWidth: '85%',
                fontSize: '0.875rem',
                backgroundColor: msg.role === 'user' ? '#dbeafe' : '#f3f4f6', // 藍色/灰色背景
                color: msg.role === 'user' ? '#1e3a8a' : '#1f2937', // 對應文字顏色
              }}
            >
              {/* 使用 ReactMarkdown 渲染助理的回應 */}
              {msg.role === 'assistant' ? (
                 <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({/* node, */ ...props}) => <p style={{ marginBottom: '0.25rem' }} {...props} />,
                      code: ({ /* node, */ className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '');
                        return match ? (
                          <SyntaxHighlighter
                            style={atomDark}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...props} style={{ backgroundColor: '#f3f4f6', padding: '0.2em 0.4em', borderRadius: '3px', fontSize: '85%' }}>
                            {children}
                          </code>
                        );
                      },
                      table: ({/* node, */ ...props}) => <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '1rem', fontSize: '0.85rem', border: '1px solid #d1d5db' }} {...props} />,
                      thead: ({/* node, */ ...props}) => <thead style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }} {...props} />,
                      th: ({/* node, */ ...props}) => <th style={{ border: '1px solid #d1d5db', padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 600 }} {...props} />,
                      td: ({/* node, */ ...props}) => <td style={{ border: '1px solid #e5e7eb', padding: '0.4rem 0.6rem' }} {...props} />,
                    }}
                  >
              {msg.text}
                  </ReactMarkdown>
              ) : (
                msg.text // 使用者訊息直接顯示
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
             <div style={{ padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: '#f3f4f6', color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>
               思考中...
      </div>
          </div>
        )}
      </div>
      <div style={inputAreaStyle}>
      <input
          type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && sendMessage()}
          placeholder="輸入問題..."
          style={inputStyle}
        disabled={loading}
      />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={loading || !input.trim() ? disabledButtonStyle : buttonStyle}
          onMouseOver={(e) => { if (!loading && input.trim()) (e.target as HTMLButtonElement).style.backgroundColor = '#1e40af'; }} // Hover 效果
          onMouseOut={(e) => { if (!loading && input.trim()) (e.target as HTMLButtonElement).style.backgroundColor = '#1d4ed8'; }}
        >
        送出
      </button>
      </div>
    </div>
  );
}


// --- 主元件 ---
export default function GenerateCourse() {
  const [prompt, setPrompt] = useState("");
  const [loadingStep, setLoadingStep] = useState<"outline" | "sections" | "videos" | "questions" | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState("");
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<{ [sectionIdx: string]: number }>({});
  const [selectedOption, setSelectedOption] = useState<{ [sectionIdx: string]: string | null }>({});
  // submitted 狀態: true (答對), string (嘗試過的錯誤答案), undefined (未提交)
  const [submitted, setSubmitted] = useState<{ [sectionIdx: string]: boolean | string }>({});
  const [showHint, setShowHint] = useState<{ [sectionIdx: string]: boolean }>({});
  const [hint, setHint] = useState<{ [sectionIdx: string]: string | null }>({});
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});
  const [numSections, setNumSections] = useState(5);
  const [targetAudience, setTargetAudience] = useState<string[]>([]);
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<string[]>(["multiple_choice"]);
  const [numQuestions, setNumQuestions] = useState(2);
  const [showAssistant, setShowAssistant] = useState(false); // 新增：AI 助教展開/收合
  const [isBlockCollapsed, setIsBlockCollapsed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customSectionTitles, setCustomSectionTitles] = useState<string[]>(Array(numSections).fill(""));
  const defaultContentTypes = [
    { label: "講義", value: "lecture" },
    { label: "影片", value: "video" },
    { label: "練習題", value: "quiz" },
    { label: "討論", value: "discussion" },
  ];
  const [contentTypes, setContentTypes] = useState(defaultContentTypes);
  const [completedSteps, setCompletedSteps] = useState(0);

  // 總步驟數 = 1 (大綱) + 章節數 * 3 (內容 + 影片 + 題目)
  const totalSteps = numSections * 3 + 1;

  // 當章節數變動時，自動調整 customSectionTitles 長度
  useEffect(() => {
    setCustomSectionTitles((prev) => {
      const arr = [...prev];
      arr.length = numSections;
      for (let i = 0; i < numSections; i++) {
        if (arr[i] === undefined) arr[i] = "";
      }
      return arr;
    });
  }, [numSections]);

  const handleCustomSectionTitleChange = (idx: number, value: string) => {
    setCustomSectionTitles((prev) => {
      const arr = [...prev];
      arr[idx] = value;
      return arr;
    });
  };

  // 新增：討論題狀態
  const [discussionAnswers, setDiscussionAnswers] = useState<{ [sectionIdx: string]: string }>({});
  const [discussionFeedback, setDiscussionFeedback] = useState<{ [sectionIdx: string]: string }>({});
  const [discussionLoading, setDiscussionLoading] = useState<{ [sectionIdx: string]: boolean }>({});

  // 分步產生主流程
  const handleGenerate = async () => {
    try {
      setError("");
      setSections([]);
      setCompletedSteps(0);
      setExpandedSections({});
      setCurrentQuestionIdx({});
      setSelectedOption({});
      setSubmitted({});
      setShowHint({});
      setHint({});
      setIsGenerating(true);

      if (selectedQuestionTypes.length === 0) {
        setError("請至少選擇一種題目型態再產生課程。");
        // setLoadingStep(null); // 不需要，因為還沒開始
        setIsGenerating(false);
        return;
      }

      // 1. 產生大綱
      setLoadingStep("outline");
      let outlineArr: string[] = [];
      // 修改：接收回傳物件並檢查 error 屬性
      const outlineResult = await fetchWithRetry<{ outline: string[] }>("/api/generate-outline", {
        prompt,
        numSections,
        targetAudience,
        customSectionTitles: customSectionTitles.map(t => t.trim()),
      });

      if (outlineResult.error) {
        // 修改：從回傳的 error 物件取得訊息
        setError(outlineResult.error.message || "產生大綱失敗");
        setLoadingStep(null);
        setIsGenerating(false);
        return;
      }
      // 斷言 data 不為 null，因為 error 為 null
      outlineArr = outlineResult.data!.outline;


      const initialSections: Section[] = outlineArr.map(title => ({
        title, content: "", questions: [], videoUrl: "", error: undefined
      }));
      setSections([...initialSections]);
      if (initialSections.length > 0) setExpandedSections({ '0': true });

      // 2. 依序產生每一個章節的內容、影片、題目
      const sectionArr = [...initialSections];
      const totalSteps = outlineArr.length * contentTypes.length;

      for (let i = 0; i < outlineArr.length; i++) {
        // 2-1. 產生 section（只有 lecture 有被選擇才產生）
        if (contentTypes.some(t => t.value === "lecture")) {
          setLoadingStep("sections");
          const sectionResult = await fetchWithRetry<{ content: string }>("/api/generate-section", { sectionTitle: outlineArr[i], courseTitle: prompt, targetAudience });
          if (sectionResult.error) {
            sectionArr[i].error = {
              type: "section",
              message: sectionResult.error.message || "產生章節內容失敗",
              retrying: false
            };
            setSections([...sectionArr]);
            setCompletedSteps(prev => prev + 1);
            continue;
          }
          sectionArr[i].content = sectionResult.data!.content;
          sectionArr[i].error = undefined;
          setSections([...sectionArr]);
          setCompletedSteps(prev => prev + 1);
        }

        // 2-2. 產生 video（只有 video 有被選擇才產生）
        if (contentTypes.some(t => t.value === "video")) {
          const videoResult = await fetchWithRetry<{ videoUrl: string }>("/api/generate-video", { sectionTitle: sectionArr[i].title, sectionContent: sectionArr[i].content, targetAudience });
          if (videoResult.error) {
            sectionArr[i].error = {
              type: "video",
              message: videoResult.error.message || "產生影片失敗",
              retrying: false
            };
            setSections([...sectionArr]);
            setCompletedSteps(prev => prev + 1);
          } else {
            sectionArr[i].videoUrl = videoResult.data!.videoUrl;
            setSections([...sectionArr]);
            setCompletedSteps(prev => prev + 1);
          }
        }

        // 2-3. 產生 questions（只有 quiz 有被選擇才產生）
        if (contentTypes.some(t => t.value === "quiz")) {
          const typesString = selectedQuestionTypes.join(",");
          const questionsResult = await fetchWithRetry<{ questions: Question[] }>("/api/generate-questions", {
            sectionTitle: sectionArr[i].title,
            sectionContent: sectionArr[i].content,
            ...(targetAudience && { targetAudience }),
            selectedQuestionTypes: typesString,
            numQuestions
          });
          if (questionsResult.error) {
            sectionArr[i].error = {
              type: "questions",
              message: questionsResult.error.message || "產生題目失敗",
              retrying: false
            };
            setSections([...sectionArr]);
            setCompletedSteps(prev => prev + 1);
            continue;
          }
          sectionArr[i].questions = Array.isArray(questionsResult.data?.questions)
            ? questionsResult.data.questions
            : [];
          setSections([...sectionArr]);
          setCompletedSteps(prev => prev + 1);
        }
      }

      setLoadingStep(null);
      setCompletedSteps(totalSteps);
      setIsGenerating(false);
      setIsBlockCollapsed(true);
    // 注意：這裡的 try...catch 仍然捕捉 handleGenerate 函數內 *其他* 可能的同步錯誤
    // 但 fetchWithRetry 本身的錯誤已經在內部處理並回傳了
    } catch (err) {
      // 這個 catch 現在主要處理非 fetchWithRetry 造成的預期外錯誤
      setError(err instanceof Error ? err.message : "產生課程時發生未預期錯誤");
      setIsGenerating(false);
      setLoadingStep(null);
    }
  };

  // --- 重試邏輯 ---
  // （整個 handleRetry function 刪除）

  // --- 樣式定義 ---
  const containerStyle: CSSProperties = {
    maxWidth: '800px', // 適中寬度
    margin: '0 auto', // 置中
    padding: '2rem', // 內邊距
    backgroundColor: '#f0f4f8', // 淺灰藍背景
    minHeight: '100vh',
  };

  const cardStyle: CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    padding: '1.5rem',
    marginBottom: '2rem', // 主要區塊間距
  };

  const inputLabelStyle: CSSProperties = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#4b5563', // 深灰色
    marginBottom: '0.25rem',
  };

  const inputStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '0.6rem 0.75rem',
    fontSize: '1rem',
    border: '1px solid #d1d5db', // 灰色邊框
    borderRadius: '6px',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
  };

  const numberInputStyle: CSSProperties = {
    ...inputStyle,
    width: '80px', // 數字輸入框固定寬度
  };

  const checkboxLabelStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.9rem',
  };

  const generateButtonStyle: CSSProperties = {
    backgroundColor: '#22c55e', // 綠色
    color: 'white',
    fontWeight: 600,
    padding: '0.75rem 1.5rem',
    borderRadius: '0.375rem',
    fontSize: '1rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%', // 填滿容器寬度
    marginTop: '1rem', // 與上方元素間距
  };

  const disabledButtonStyle: CSSProperties = {
    // 繼承基礎樣式，但改變外觀表示禁用
    // 注意：這裡不直接繼承 generateButtonStyle，因為 hover 效果不需要
    backgroundColor: '#9ca3af', // 灰色背景表示禁用
    color: '#e5e7eb', // 淺灰色文字
    fontWeight: 600,
    padding: '0.75rem 1.5rem',
    borderRadius: '0.375rem',
    fontSize: '1rem',
    border: 'none',
    cursor: 'not-allowed', // 禁用鼠標樣式
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: '1rem',
    opacity: 0.6, // 降低透明度
  };

  const sectionCardStyle: CSSProperties = {
    border: '1px solid #e5e7eb', // 統一邊框
    borderRadius: '8px',
    margin: '1.5rem 0', // 卡片間距
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
    overflow: 'hidden', // 避免子元素溢出圓角
  };

  const sectionHeaderStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '1rem 1.5rem', // 標題區內邊距
    cursor: 'pointer',
    userSelect: 'none',
    backgroundColor: '#f9fafb', // 淺灰色背景
    borderBottom: '1px solid #e5e7eb', // 分隔線
  };

  const sectionTitleStyle: CSSProperties = {
    color: '#111827', // 更深的標題顏色
    margin: 0,
    flex: 1,
    fontWeight: 600, // 加粗
    fontSize: '1.1rem', // 稍大字體
  };

  const sectionContentStyle: CSSProperties = {
    padding: '1.5rem', // 內容區內邊距
  };

  const videoContainerStyle: CSSProperties = {
    aspectRatio: '16 / 9', // 保持比例
    width: '100%',
    maxWidth: '640px', // 限制最大寬度
    margin: '0 auto 1.5rem auto', // 置中並添加底部間距
  };

  const questionAreaStyle: CSSProperties = {
    marginTop: '0.2rem',
    paddingTop: 0,
    paddingLeft: '1em',
    // borderTop: '1px solid #e5e7eb', // 已移除
  };

  const lectureAreaStyle: CSSProperties = {
    paddingLeft: '1em',
  };

  // 選項標籤基礎樣式 - 使用獨立邊框屬性
  const optionLabelBaseStyle: CSSProperties = {
    display: 'block', // display: block 在 column 方向下仍然有效
    padding: '0.75rem 1rem',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s, border-color 0.2s',
    backgroundColor: '#ffffff',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    color: '#374151',
  };

  // 選項標籤 Hover 樣式 - 只修改需要的獨立屬性
  const optionLabelHoverStyle: CSSProperties = {
    backgroundColor: '#f9fafb', // 淡灰色背景
    borderColor: '#9ca3af', // 邊框變深
  };

  // 選項標籤選中樣式 - 只修改需要的獨立屬性
  const optionLabelSelectedStyle: CSSProperties = {
    backgroundColor: '#eff6ff', // 淡藍色背景
    borderColor: '#60a5fa', // 藍色邊框
  };

  // 選項標籤答對樣式 - 只修改需要的獨立屬性
  const optionLabelCorrectStyle: CSSProperties = {
    backgroundColor: '#f0fdf4', // 淡綠色背景
    borderColor: '#4ade80', // 綠色邊框
    color: '#15803d', // 深綠色文字
  };

  // 選項標籤答錯樣式 - 只修改需要的獨立屬性
  const optionLabelIncorrectStyle: CSSProperties = {
    backgroundColor: '#fef2f2', // 淡紅色背景
    borderColor: '#f87171', // 紅色邊框
    color: '#b91c1c', // 深紅色文字
  };

  const actionButtonStyle: CSSProperties = {
    border: 'none',
    borderRadius: '6px',
    padding: '0.5rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s, opacity 0.2s',
    marginRight: '0.75rem', // 按鈕間距
  };

  const submitButtonStyle: CSSProperties = {
    ...actionButtonStyle,
    backgroundColor: '#2563eb', // 藍色
    color: 'white',
  };

  const hintButtonStyle: CSSProperties = {
    ...actionButtonStyle,
    backgroundColor: 'transparent',
    color: '#2563eb', // 藍色文字
    border: '1px solid #2563eb', // 藍色邊框
  };

   const nextButtonStyle: CSSProperties = {
    ...actionButtonStyle,
    backgroundColor: '#16a34a', // 綠色
    color: 'white',
  };

  const disabledActionButtonStyle: CSSProperties = {
    ...actionButtonStyle,
    opacity: 0.5,
    cursor: 'not-allowed',
  };

  const feedbackBoxBaseStyle: CSSProperties = {
      marginTop: '1rem',
      padding: '0.75rem 1rem',
      borderRadius: '6px',
      fontSize: '0.875rem',
      fontWeight: 500,
      border: '1px solid',
  };

  const feedbackCorrectStyle: CSSProperties = {
      ...feedbackBoxBaseStyle,
      backgroundColor: '#f0fdf4',
      borderColor: '#a7f3d0',
      color: '#047857',
  };

  const feedbackIncorrectStyle: CSSProperties = {
      ...feedbackBoxBaseStyle,
      backgroundColor: '#fef2f2',
      borderColor: '#fecaca',
      color: '#b91c1c',
  };

  const hintBoxStyle: CSSProperties = {
      ...feedbackBoxBaseStyle,
      backgroundColor: '#eff6ff',
      borderColor: '#bfdbfe',
      color: '#1d4ed8',
  };

  const errorBoxStyle: CSSProperties = {
      backgroundColor: '#fef2f2', // 淡紅色背景
      border: '1px solid #fecaca', // 紅色邊框
      color: '#b91c1c', // 深紅色文字
      padding: '0.75rem 1rem',
      borderRadius: '6px',
      marginBottom: '1rem',
      fontSize: '0.875rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
  };

  const titleStyle: CSSProperties = {
    fontSize: '2rem',
        fontWeight: 700,
    color: '#1f2937',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.5rem'
  };

  const subtitleStyle: CSSProperties = {
    color: '#4b5563'
  };

  // --- 計算進度百分比 (更細緻) ---
  const progressValue = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  // --- 結束修正 ---

  // --- 處理題目顯示和互動的邏輯 ---
  const renderQuestions = (sec: Section, secIndex: number) => {
    const currentQIdx = currentQuestionIdx[String(secIndex)] ?? 0;
    const question = sec.questions?.[currentQIdx];
    const submittedValue = submitted[String(secIndex)];

    if (!question) {
      return <p>無法載入題目。</p>;
    }

    const optionsToShow = question.options || [];
    const isTF = question.options && question.options.length === 2 && question.options.every((opt: string) => ['是', '否', 'True', 'False', '對', '錯'].includes(opt));
    const currentSelected = selectedOption[String(secIndex)];
    // 只有已提交時才判斷對錯
    const isCorrectAnswer = submittedValue !== undefined && (
      isTF
        ? (submittedValue === '是' && ['是', 'True', '對'].includes(question.answer)) ||
          (submittedValue === '否' && ['否', 'False', '錯'].includes(question.answer))
        : submittedValue === question.answer
    );

    return (
      <div style={questionAreaStyle}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: '#374151' }}>隨堂練習</h4>
        <div>
          <div style={{ marginBottom: '1rem', fontWeight: 500, color: '#1f2937' }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              unwrapDisallowed={true}
            >
              {`${currentQIdx + 1}. ${question.question_text}`}
            </ReactMarkdown>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {optionsToShow.map((opt: string, i: number) => {
              const isSelected = currentSelected === opt;
              // 提交後才顯示正確/錯誤樣式
              const showFailure = submittedValue === opt && !isCorrectAnswer;
              const showSuccess = submittedValue === opt && isCorrectAnswer;

              let currentStyle = { ...optionLabelBaseStyle };
              if (isSelected && submittedValue === undefined) currentStyle = { ...currentStyle, ...optionLabelSelectedStyle };
              if (showSuccess) currentStyle = { ...currentStyle, ...optionLabelCorrectStyle };
              if (showFailure) currentStyle = { ...currentStyle, ...optionLabelIncorrectStyle };

              return (
                <label
                  key={i}
                  style={currentStyle}
                  onMouseOver={(e) => { if (submittedValue === undefined && !isSelected) (e.currentTarget as HTMLLabelElement).style.backgroundColor = optionLabelHoverStyle.backgroundColor ?? ''; }}
                  onMouseOut={(e) => { if (submittedValue === undefined && !isSelected) (e.currentTarget as HTMLLabelElement).style.backgroundColor = optionLabelBaseStyle.backgroundColor ?? ''; }}
                >
                  <input
                    type="radio"
                    name={`question-${secIndex}-${currentQIdx}`}
                    value={opt}
                    checked={isSelected}
                    onChange={() => {
                      if (isCorrectAnswer) return;
                      setSelectedOption(s => ({ ...s, [String(secIndex)]: opt }));
                    }}
                    disabled={isCorrectAnswer}
                    style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}
                  />
                  <span style={{ verticalAlign: 'middle' }}>{opt}</span>
                </label>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              onClick={() => {
                if (!currentSelected) return;
                setSubmitted(s => ({ ...s, [String(secIndex)]: currentSelected }));
              }}
              disabled={!currentSelected || isCorrectAnswer}
              style={(!currentSelected || isCorrectAnswer) ? { ...submitButtonStyle, ...disabledActionButtonStyle } : submitButtonStyle}
            >
              提交答案
            </button>
            <button
              onClick={async () => {
                setShowHint(h => ({ ...h, [String(secIndex)]: true }));
                if (!hint[String(secIndex)] && !question.hint) {
                  try {
                    const res = await fetch("/api/generate-hint", { /* ... body ... */ });
                    const data = await res.json();
                    setHint(h => ({ ...h, [String(secIndex)]: data.hint ?? "暫無提示" }));
                  } catch {
                    setHint(h => ({ ...h, [String(secIndex)]: "獲取提示失敗" }));
                  }
                }
              }}
              style={(showHint[String(secIndex)] || submittedValue !== undefined) ? { ...hintButtonStyle, ...disabledActionButtonStyle } : hintButtonStyle}
              disabled={showHint[String(secIndex)] || submittedValue !== undefined}
            >
              {showHint[String(secIndex)] ? "提示已顯示" : "需要提示"}
            </button>
            {isCorrectAnswer && currentQIdx < sec.questions.length - 1 && (
              <button
                onClick={() => {
                  setCurrentQuestionIdx(c => ({ ...c, [String(secIndex)]: currentQIdx + 1 }));
                  setSelectedOption(s => ({ ...s, [String(secIndex)]: null }));
                  setSubmitted(s => { const newS = { ...s }; delete newS[String(secIndex)]; return newS; });
                  setShowHint(h => ({ ...h, [String(secIndex)]: false }));
                  setHint(h => ({ ...h, [String(secIndex)]: null }));
                }}
                style={nextButtonStyle}
              >
                下一題 →
              </button>
            )}
          </div>
          {showHint[String(secIndex)] && (
            <div style={hintBoxStyle}>
              <strong>提示：</strong>{hint[String(secIndex)] || question.hint || "正在加載提示..."}
            </div>
          )}
          {submittedValue !== undefined && (
            isCorrectAnswer ? (
              <div style={feedbackCorrectStyle}>
                ✅ 恭喜答對了！
                {currentQIdx === sec.questions.length - 1 && <span> (🎉 本章練習結束)</span>}
              </div>
            ) : (
              <div style={feedbackIncorrectStyle}>
                ❌ 答錯了，請參考提示或重新選擇。
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={containerStyle}>
      {/* 標題區 */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={titleStyle}>
          <span role="img" aria-label="AI" style={{ fontSize: '2.2rem', marginRight: '0.75rem' }}>🤖</span>
          AI 課程產生器
      </h1>
        <p style={subtitleStyle}>
          輸入你想學習的主題，AI 將自動為你生成課程大綱、詳細講義、教學影片與隨堂練習題！
        </p>
      </div>

      {/* 設定區塊收合/展開按鈕 */}
      <div style={{ marginBottom: '1rem', textAlign: 'right' }}>
        <button
          onClick={() => setIsBlockCollapsed((prev) => !prev)}
          style={{
            background: 'none',
            border: 'none',
            color: '#2563eb',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            outline: 'none',
            padding: 0,
          }}
        >
          {isBlockCollapsed ? '展開課程設定 ⬇️' : '收合課程設定 ⬆️'}
        </button>
      </div>
      {/* 課程輸入區（可收合） */}
      {!isBlockCollapsed && (
        <div style={cardStyle}>
          {/* group0: 主題設定 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="prompt" style={inputLabelStyle}>
              課程主題或敘述 <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>(例如：Python 入門、數據分析基礎)</span>
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="請輸入你想學習的主題或需求描述..."
              style={{
                ...inputStyle,
                minHeight: '80px',
                width: '100%',
                resize: 'vertical',
                fontFamily: 'inherit',
                fontSize: '1.05rem',
                boxSizing: 'border-box',
                padding: '1.25rem 1.5rem', // 上下 1.25rem，左右 1.5rem
              }}
              disabled={isGenerating}
            />
          </div>

          {/* group1: 目標年級 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="targetAudience" style={inputLabelStyle}>目標年級</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
              {[
                { label: "國小低年級", value: "國小低年級" },
                { label: "國小中年級", value: "國小中年級" },
                { label: "國小高年級", value: "國小高年級" },
                { label: "國中生", value: "國中生" },
                { label: "高中生", value: "高中生" },
                { label: "大學生", value: "大學生" },
                { label: "社會人士", value: "社會人士" },
              ].map((opt) => (
                <label key={opt.value} style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    value={opt.value}
                    checked={targetAudience.includes(opt.value)}
                    onChange={(e) => {
                      const { value, checked } = e.target;
                      setTargetAudience(prev =>
                        checked ? [...prev, value] : prev.filter(t => t !== value)
                      );
                    }}
                    disabled={isGenerating}
                    style={{ width: '1rem', height: '1rem', accentColor: '#2563eb' }} // 調整 checkbox 樣式
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* group2: 章節數 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="numSections" style={inputLabelStyle}>章節數 (3-10)</label>
            <input
              type="number"
              id="numSections"
              value={numSections}
              onChange={(e) => setNumSections(Math.max(3, Math.min(10, parseInt(e.target.value, 10) || 3)))}
              min="3" max="10"
              style={numberInputStyle}
              disabled={isGenerating}
            />
            {/* 客製化章節標題 */}
            <div style={{ marginTop: '1rem' }}>
              <label style={{ ...inputLabelStyle, marginBottom: 0 }}>自訂章節名稱（可選填）</label>
              {Array.from({ length: numSections }).map((_, idx) => (
                <div key={idx} style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#6b7280', minWidth: 32 }}>{idx + 1}.</span>
                  <input
                    type="text"
                    value={customSectionTitles[idx] || ""}
                    onChange={e => handleCustomSectionTitleChange(idx, e.target.value)}
                    placeholder={`第 ${idx + 1} 章名稱（留空則由 AI 產生）`}
                    style={{ ...inputStyle, width: '70%' }}
                    disabled={isGenerating}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* groupX: 內容型別設定（僅當練習題有被選擇時顯示） */}
          {(selectedQuestionTypes.includes("multiple_choice") || selectedQuestionTypes.includes("true_false")) && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={inputLabelStyle}>內容型別（可拖曳排序、可刪除、可新增）</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start', marginTop: '0.5rem' }}>
                {contentTypes.map((type) => (
                  <div
                    key={type.value}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('text/plain', type.value);
                    }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      const fromIdx = Number(e.dataTransfer.getData('text/plain'));
                      if (fromIdx === contentTypes.indexOf(type)) return;
                      setContentTypes(prev => {
                        const arr = [...prev];
                        const [moved] = arr.splice(fromIdx, 1);
                        arr.splice(contentTypes.indexOf(type), 0, moved);
                        return arr;
                      });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: '#f3f4f6',
                      borderRadius: '20px',
                      padding: '0.4rem 1rem',
                      fontSize: '0.95rem',
                      fontWeight: 500,
                      border: '1px solid #d1d5db',
                      cursor: 'grab',
                      userSelect: 'none',
                    }}
                    title="可拖曳排序"
                  >
                    <span>{type.label}</span>
                    {contentTypes.length > 1 && (
                      <button
                        onClick={() => setContentTypes(prev => prev.filter(t => t !== type))}
                        style={{
                          marginLeft: '0.5rem',
                          background: 'none',
                          border: 'none',
                          color: '#b91c1c',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          cursor: 'pointer',
                          lineHeight: 1,
                        }}
                        title="刪除"
                        type="button"
                      >✖</button>
                    )}
                  </div>
                ))}
                {/* 新增型別按鈕（獨立一行） */}
                <button
                  onClick={() => {
                    const builtins = [
                      { label: "講義", value: "lecture" },
                      { label: "練習題", value: "quiz" },
                      { label: "影片", value: "video" },
                      { label: "討論", value: "discussion" },
                    ];
                    const canAdd = builtins.filter(b => !contentTypes.some(t => t.value === b.value));
                    if (canAdd.length === 0) return;
                    setContentTypes(prev => [...prev, canAdd[0]]);
                  }}
                  style={{
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '2rem',
                    height: '2rem',
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '0.5rem',
                  }}
                  title="新增內容型別"
                  type="button"
                  disabled={contentTypes.length >= 4}
                >＋</button>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
                拖曳可排序，點擊 <span style={{ color: '#b91c1c' }}>✖</span> 可刪除，點 <b>＋</b> 可新增（最多 4 種）
              </div>
            </div>
          )}

          {/* group5 & group6: 僅當內容型別有練習題時才顯示 */}
          {contentTypes.some(t => t.value === "quiz") && (
            <>
              {/* group5: 每章題數 */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="numQuestions" style={inputLabelStyle}>每章題數 (1-5)</label>
                <input
                  type="number"
                  id="numQuestions"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Math.max(1, Math.min(5, parseInt(e.target.value, 10) || 1)))}
                  min="1" max="5"
                  style={numberInputStyle}
                  disabled={isGenerating}
                />
              </div>
              {/* group6: 題目型態 (可複選) */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={inputLabelStyle}>題目型態 (可複選)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
                  {[
                    { label: "選擇題", value: "multiple_choice" },
                    { label: "是非題", value: "true_false" },
                    // { label: "簡答題", value: "short_answer" },
                  ].map((type) => (
                    <label key={type.value} style={checkboxLabelStyle}>
                      <input
                        type="checkbox"
                        value={type.value}
                        checked={selectedQuestionTypes.includes(type.value)}
                        onChange={(e) => {
                          const { value, checked } = e.target;
                          setSelectedQuestionTypes(prev =>
                            checked ? [...prev, value] : prev.filter(t => t !== value)
                          );
                        }}
                        disabled={isGenerating}
                        style={{ width: '1rem', height: '1rem', accentColor: '#2563eb' }} // 調整 checkbox 樣式
                      />
                      {type.label}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 產生按鈕 */}
          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              style={isGenerating || !prompt.trim() ? disabledButtonStyle : generateButtonStyle}
              onMouseOver={(e) => { if (!isGenerating && prompt.trim()) (e.target as HTMLButtonElement).style.backgroundColor = '#16a34a'; }} // Hover 效果
              onMouseOut={(e) => { if (!isGenerating && prompt.trim()) (e.target as HTMLButtonElement).style.backgroundColor = '#22c55e'; }}
            >
              {isGenerating ? `產生中 (${loadingStep})...` : '開始產生課程'}
            </button>
          </div>
        </div>
      )}

      {/* 全局錯誤訊息 (非產生中) */}
      {error && !isGenerating && (
        <div style={errorBoxStyle}>
          <span>{error}</span>
          {/* 可以考慮是否需要全局重試按鈕 */}
        </div>
      )}

      {/* 進度條 */}
      {isGenerating && (
        <div style={{ margin: "1.5rem 0" }}>
          <progress value={completedSteps} max={totalSteps} style={{ width: '100%', height: '8px', appearance: 'none' }} />
          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#4b5563', marginTop: '0.5rem' }}>
            正在產生 {loadingStep}...（{completedSteps} / {totalSteps}，{progressValue}%）
          </p>
        </div>
      )}

      {/* 課程內容 */}
      {sections.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          {/* 課程標題 (可選) */}
          {/* <h2 style={{ color: '#111827', borderBottom: '2px solid #9ca3af', paddingBottom: '0.5rem', marginBottom: '1rem' }}>{prompt}</h2> */}

          {sections.map((sec, idx) => {
            const isExpanded = expandedSections[String(idx)];
            // （這行刪除）

            return (
              <div key={idx} style={sectionCardStyle}>
                {/* 標題列 */}
                <div
                  style={{
                    ...sectionHeaderStyle,
                    borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none', // 收合時移除底線
                  }}
                  onClick={() => setExpandedSections(s => ({ ...s, [String(idx)]: !isExpanded }))}
                >
                  <h3 style={sectionTitleStyle}>
                    {sec.title || <SkeletonBlock width="40%" height={24} style={{ backgroundColor: '#e5e7eb' }} />}
                  </h3>
                  {/* 載入/錯誤指示 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                    {sec.error && <span title={sec.error.message} style={{ color: '#ef4444', fontSize: '1.1rem' }}>⚠️</span>}
                    {isGenerating && !sec.error && (
                      (loadingStep === 'sections' && !sec.content) ||
                      (loadingStep === 'videos' && sec.content && !sec.videoUrl) ||
                      (loadingStep === 'questions' && sec.content && (!sec.questions || sec.questions.length === 0))
                    ) && <SkeletonBlock height={16} width={16} style={{ borderRadius: '50%', backgroundColor: '#d1d5db' }} />}
                    <span style={{ fontSize: '1rem', color: '#6b7280', transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                  </div>
                </div>

                {/* 卡片內容 (可展開) */}
                {isExpanded && (
                  <div style={sectionContentStyle}>
                    {/* 動態依 contentTypes 排序渲染內容 */}
                    {contentTypes.map((type) => {
                      if (type.value === "lecture") {
                        return (
                          <div key={type.value} style={{ marginBottom: '1.5rem' }}>
                            <div style={{
                              display: 'inline-block',
                              background: '#e0e7ff',
                              color: '#3730a3',
                              fontWeight: 600,
                              borderRadius: '6px',
                              padding: '0.2rem 0.8rem',
                              fontSize: '0.95rem',
                              marginBottom: '0.5rem'
                            }}>講義</div>
                            {/* 講義內容 */}
                            {sec.content ? (
                              <div style={{ ...lectureAreaStyle, color: "#374151", lineHeight: 1.7 }}>
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    code({ className, children, ...props }) {
                                      const match = /language-(\w+)/.exec(className || '');
                                      return match ? (
                                        <SyntaxHighlighter
                                          style={atomDark} language={match[1]} PreTag="div"
                                          customStyle={{ borderRadius: '4px', fontSize: '0.85rem', margin: '0.5rem 0' }}
                                          {...props}
                                        >
                                          {String(children).replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                      ) : (
                                        <code style={{ backgroundColor: '#e5e7eb', padding: '0.1rem 0.3rem', borderRadius: '4px', fontSize: '0.85rem', color: '#1f2937' }} className={className} {...props}>
                                          {children}
                                        </code>
                                      );
                                    },
                                    p: (props) => <p style={{ marginBottom: '0.8rem' }} {...props} />,
                                    ul: (props) => <ul style={{ paddingLeft: '1.5rem', marginBottom: '0.8rem' }} {...props} />,
                                    ol: (props) => <ol style={{ paddingLeft: '1.5rem', marginBottom: '0.8rem' }} {...props} />,
                                    li: (props) => <li style={{ marginBottom: '0.3rem' }} {...props} />,
                                    table: (props) => <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '1rem', fontSize: '0.9rem', border: '1px solid #d1d5db' }} {...props} />,
                                    thead: (props) => <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }} {...props} />,
                                    th: (props) => <th style={{ border: '1px solid #d1d5db', padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }} {...props} />,
                                    td: (props) => <td style={{ border: '1px solid #e5e7eb', padding: '0.5rem 0.75rem' }} {...props} />,
                                  }}
                                >
                                  {sec.content}
                                </ReactMarkdown>
                              </div>
                            ) : (
                              <div style={{ marginBottom: '1.5rem' }}>
                                <SkeletonBlock height={20} width="90%" style={{ marginBottom: '0.75rem', backgroundColor: '#e5e7eb' }} />
                                <SkeletonBlock height={20} width="80%" style={{ marginBottom: '0.75rem', backgroundColor: '#e5e7eb' }} />
                                <SkeletonBlock height={20} width="85%" style={{ backgroundColor: '#e5e7eb' }} />
                              </div>
                            )}
                          </div>
                        );
                      }
                      if (type.value === "video") {
                        return (
                          <div key={type.value} style={{ marginBottom: '1.5rem' }}>
                            <div style={{
                              display: 'inline-block',
                              background: '#fef9c3',
                              color: '#b45309',
                              fontWeight: 600,
                              borderRadius: '6px',
                              padding: '0.2rem 0.8rem',
                              fontSize: '0.95rem',
                              marginBottom: '0.5rem'
                            }}>影片</div>
                            {/* 影片內容 */}
                            {sec.videoUrl ? (
                              <div
                                style={{
                                  width: '100%',
                                  maxWidth: 640,
                                  aspectRatio: '16/9',
                                  background: '#ccc',
                                  overflow: 'hidden',
                                  borderRadius: 8,
                                  margin: '0 auto',
                                  position: 'relative',
                                }}
                              >
                                <Image
                                  src={sec.videoUrl}
                                  alt="影片示意圖"
                                  fill
                                  style={{
                                    objectFit: 'cover'
                                  }}
                                />
                              </div>
                            ) : (
                              <div style={videoContainerStyle}>
                                <SkeletonBlock height="100%" width="100%" style={{ borderRadius: '8px', backgroundColor: '#e5e7eb' }} />
                              </div>
                            )}
                          </div>
                        );
                      }
                      if (type.value === "quiz") {
                        return (
                          <div key={type.value} style={{ marginBottom: '1.5rem' }}>
                            <div style={{
                              display: 'inline-block',
                              background: '#dcfce7',
                              color: '#166534',
                              fontWeight: 600,
                              borderRadius: '6px',
                              padding: '0.2rem 0.8rem',
                              fontSize: '0.95rem',
                              marginBottom: '0.5rem'
                            }}>練習題</div>
                            {/* 練習題內容 */}
                            {sec.questions && sec.questions.length > 0 ? (
                              renderQuestions(sec, idx)
                            ) : (
                              <div style={questionAreaStyle}>
                                <SkeletonBlock height={24} width="120px" style={{ backgroundColor: '#e5e7eb' }} />
                                <SkeletonBlock height={20} width="80%" style={{ marginBottom: '1rem', backgroundColor: '#e5e7eb' }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  <SkeletonBlock height={48} width="100%" style={{ backgroundColor: '#e5e7eb', borderRadius: '6px' }} />
                                  <SkeletonBlock height={48} width="100%" style={{ backgroundColor: '#e5e7eb', borderRadius: '6px' }} />
                                  <SkeletonBlock height={48} width="100%" style={{ backgroundColor: '#e5e7eb', borderRadius: '6px' }} />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }
                      // 新增：討論題狀態
                      if (type.value === "discussion") {
                        return (
                          <div key={type.value} style={{ marginBottom: '1.5rem' }}>
                            <div style={{
                              display: 'inline-block',
                              background: '#f3e8ff',
                              color: '#7c3aed',
                              fontWeight: 600,
                              borderRadius: '6px',
                              padding: '0.2rem 0.8rem',
                              fontSize: '0.95rem',
                              marginBottom: '0.5rem'
                            }}>討論</div>
                            {/* 申論題內容 */}
                            <div style={{ margin: '1rem 0' }}>
                              <strong>申論題：</strong>
                              <div style={{ margin: '0.5rem 0 1rem 0', color: '#4b5563' }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {sec.content
                                    ? `請根據本章內容，寫一段小論文或申論，說明你對於「${sec.title}」的理解與看法。`
                                    : `請針對「${sec.title}」這個主題，寫一段小論文或申論，說明你的理解與看法。`
                                  }
                                </ReactMarkdown>
                              </div>
                              <div data-color-mode="light">
                                <MDEditor
                                  value={discussionAnswers[String(idx)] || ""}
                                  onChange={val => setDiscussionAnswers(ans => ({ ...ans, [String(idx)]: val || "" }))}
                                  height={200}
                                  preview="live"
                                  textareaProps={{
                                    placeholder: "請在此輸入你的申論內容（支援 Markdown 排版）...",
                                    disabled: discussionLoading[String(idx)],
                                  }}
                                />
                              </div>
                              <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                                支援 <a href="https://markdown.tw/" target="_blank" rel="noopener noreferrer">Markdown</a> 排版
                              </div>
                              <div>
                                <button
                                  onClick={async () => {
                                    setDiscussionLoading(l => ({ ...l, [String(idx)]: true }));
                                    setDiscussionFeedback(f => ({ ...f, [String(idx)]: "" }));
                                    try {
                                      const res = await fetch("/api/grade-essay", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          sectionTitle: sec.title,
                                          sectionContent: sec.content,
                                          essay: discussionAnswers[String(idx)] || "",
                                        }),
                                      });
                                      const data = await res.json();
                                      setDiscussionFeedback(f => ({ ...f, [String(idx)]: data.feedback || "AI 批改失敗，請稍後再試。" }));
                                    } catch {
                                      setDiscussionFeedback(f => ({ ...f, [String(idx)]: "AI 批改失敗，請稍後再試。" }));
                                    } finally {
                                      setDiscussionLoading(l => ({ ...l, [String(idx)]: false }));
                                    }
                                  }}
                                  disabled={
                                    !discussionAnswers[String(idx)] ||
                                    discussionLoading[String(idx)]
                                  }
                                  style={{
                                    backgroundColor: '#7c3aed',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '0.5rem 1.25rem',
                                    fontSize: '0.95rem',
                                    fontWeight: 600,
                                    cursor: discussionLoading[String(idx)] ? 'not-allowed' : 'pointer',
                                    opacity: !discussionAnswers[String(idx)] ? 0.5 : 1,
                                    marginRight: '1rem'
                                  }}
                                >
                                  {discussionLoading[String(idx)] ? "批改中..." : "送出並批改"}
                                </button>
                              </div>
                              {/* 顯示 AI 批改建議（支援 markdown） */}
                              {discussionFeedback[String(idx)] && (
                                <div style={{
                                  marginTop: '1rem',
                                  background: '#f3e8ff',
                                  color: '#7c3aed',
                                  borderRadius: 6,
                                  padding: '0.75rem 1rem',
                                  fontSize: '0.98rem',
                                  whiteSpace: 'pre-line'
                                }}>
                                  <strong>AI 批改建議：</strong>
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {discussionFeedback[String(idx)]}
                                  </ReactMarkdown>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                    {/* 章節錯誤與重試（可放在最下方或每個型別下方） */}
                    {sec.error && (
                      <div style={errorBoxStyle}>
                        <span>{sec.error.message}</span>
                        {/* ...重試按鈕... */}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AI 助教浮動按鈕與展開視窗 */}
      {sections.length > 0 && !isGenerating && (
        <>
          {showAssistant && (
            <ChatAssistant
              allContent={sections.map((s) => `${s.title}\n${s.content}`).join('\n\n')}
              targetAudience={targetAudience.join(',')}
              onClose={() => setShowAssistant(false)}
            />
          )}
          {!showAssistant && (
            <button
              onClick={() => setShowAssistant(true)}
              style={{
                position: 'fixed',
                bottom: '2.5rem',
                right: '2.5rem',
                zIndex: 100,
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                cursor: 'pointer',
                transition: 'background 0.2s, box-shadow 0.2s',
              }}
              title="展開 AI 助教"
            >
              <span style={{ fontSize: '2.2rem' }}>🤖</span>
            </button>
          )}
        </>
      )}

      {/* 全域樣式和動畫 */}
      <style jsx global>{`
        body {
          margin: 0; /* 移除預設 body margin */
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; /* 使用系統字體 */
        }
        .skeleton-block {
          background-color: #e5e7eb; /* 骨架屏基礎顏色 */
          border-radius: 4px;
          background-image: linear-gradient(90deg, #e5e7eb 0px, #f3f4f6 40px, #e5e7eb 80px);
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s infinite linear;
        }
        @keyframes skeleton-loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* --- 將 progress 樣式移到這裡 --- */
        progress::-webkit-progress-bar {
          background-color: #e5e7eb;
          border-radius: 4px;
        }
        progress::-webkit-progress-value {
          background-color: #3b82f6; /* 藍色進度 */
          border-radius: 4px;
          transition: width 0.3s ease-in-out;
        }
        progress::-moz-progress-bar { /* Firefox */
          background-color: #3b82f6;
          border-radius: 4px;
          transition: width 0.3s ease-in-out;
        }
        /* --- 結束 progress 樣式 --- */

        /* 可以加入其他需要的全域樣式 */
      `}</style>
    </div>
  );
} 