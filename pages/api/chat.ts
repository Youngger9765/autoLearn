import { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 請將這裡換成你自己的 Assistant ID
const ASSISTANT_ID = "asst_07zoyYj8i8orUZvQXHEsx7JU";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "只支援 POST 請求" });
    return;
  }

  const { allContent, question, threadId, targetAudience } = req.body;

  if (!allContent || !question) {
    res.status(400).json({ error: "缺少課程內容或提問" });
    return;
  }

  try {
    let thread_id = threadId;
    let run;
    // 先組合 audienceInstruction
    let audienceInstruction = "";
    let audienceList: string[] = [];
    if (Array.isArray(targetAudience)) {
      audienceList = targetAudience.filter((a) => a && a !== "other");
      if (audienceList.length > 0) {
        audienceInstruction = `\n請注意，學生的背景是「${audienceList.join("、")} 年級」，請用適合他們的語氣和深度回答。`;
      }
      if (targetAudience.includes("other")) {
        audienceInstruction += `\n請注意，學生的背景也包含「一般使用者」，請用適合他們的語氣和深度回答。`;
      }
    } else if (targetAudience && targetAudience !== "other" && !isNaN(Number(targetAudience))) {
      audienceInstruction = `\n請注意，學生的背景是「${targetAudience} 年級」，請用適合他們的語氣和深度回答。`;
    } else if (targetAudience === "other") {
      audienceInstruction = `\n請注意，學生的背景是「一般使用者」，請用適合他們的語氣和深度回答。`;
    }

    // 1. 若沒有 thread id，建立新 thread 並回傳
    if (!thread_id) {
      // 第一次提問，建立 thread，課程內容與問題合併為同一則 user message
      const thread = await openai.beta.threads.create({
        messages: [
          {
            role: "user",
            content: `以下是本次課程的所有內容，請參考：\n\n${allContent}\n\n---\n\n我的問題：${question}`,
          }
        ]
      });
      thread_id = thread.id;

      // run 指令加上用戶背景
      run = await openai.beta.threads.runs.create(thread_id, {
        assistant_id: ASSISTANT_ID,
        instructions: `你是一位課程 AI 助教。

[核心職責]
1. 利用上下文回答問題：每次提問都會附帶本次課程的所有內容（包含章節標題、講義、影片連結、練習題等），請根據這些最新的課程內容來回答學生的問題。
2. 結合課程結構：你也會收到課程的章節與內容摘要，請善用這些資訊，並在回答時適當引用或建議學生回顧相關章節。
3. 專注當前問題：優先針對學生當前的提問進行深入解答與討論。
4. 引導自主學習：如果問題涉及其他章節或知識點，可以引導學生回顧課程內容或探索其他章節。
5. 練習題輔導（嚴禁給答案）：如果學生提問與練習題相關，你的目標是引導他們思考、回顧相關知識點，**絕對禁止直接或間接提供答案或暗示答案**，鼓勵學生獨立解決問題。

[練習題]
- 根據課程內容，給予準確、相關的提示。
- 如果學生正在進行練習，幫助他們理解題意並給予適當提示，但不直接給答案。
- 如果學生回答了練習題，請根據他們的回答給予建設性回饋。
- 如果學生要求練習題，但課程中沒有預設題目，請根據課程內容即時創建一題合適的練習題（可為選擇題或問答題），並在學生作答後給予詳細解釋。
- 若學生多次嘗試仍無法正確作答，可適度提示，最後再給出正確答案並說明原因。

[溝通風格]
- 友善、耐心、鼓勵學生自主思考。
- 使用清晰、簡潔的語言。
- 適時使用 Markdown 格式化回答（如列表、粗體、程式碼區塊等）。

[重要限制]
- 嚴禁透露練習題答案或提供任何可能推導出答案的線索。
- 回答必須基於提供的課程內容，避免編造不相關資訊。
- 全程使用繁體中文（zh-TW）。
- 根據學生背景${audienceInstruction}調整語氣與深度。
`,
      });
    } else {
      // 有 thread_id，進行意圖分析與 context 整理
      // 1. 意圖分析
      const intentPrompt = `
你是一個AI助教，請根據以下使用者問題，判斷其意圖，並用一個簡短英文標籤回答（如: "ask_quiz", "ask_lecture", "ask_video", "ask_essay", "greeting"）：
問題：${question}
只回標籤，不要多餘說明。
      `;
      const intentResp = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: intentPrompt }],
        max_tokens: 10,
        temperature: 0,
      });
      const intent = intentResp.choices[0].message.content?.trim() || "other";

      // 2. context 整理
      let context = '';
      if (intent === 'ask_quiz') {
        // 只加入最新一筆 quiz history
        const quizHistory = req.body.quizHistory;
        let quizHistoryText = '';
        if (Array.isArray(quizHistory) && quizHistory.length > 0) {
          const item = quizHistory[quizHistory.length - 1];
          if (item) {
            const answers = (item.answers || []).map((a: { userAnswer: string; correct: boolean; timestamp: number }) =>
              `  - ${a.correct ? '✅' : '❌'} ${new Date(a.timestamp).toLocaleString('zh-TW')} 答案：${a.userAnswer}`
            ).join('\n');
            quizHistoryText = `【最近一次做題紀錄】\n${item.question}\n${answers}`;
          }
        }
        context = quizHistoryText + `\n\n 除非用戶在這一題做對，否則不要透露正確答案`;
      } else if (intent === 'ask_lecture') {
        context = allContent.split('【講義】')[1]?.split('====')[0] || '';
      } else if (intent === 'ask_video') {
        context = allContent.split('【影片】')[1]?.split('====')[0] || '';
      } else if (intent === 'ask_essay') {
        context = allContent.split('【討論】')[1]?.split('====')[0] || '';
      } else if (intent === 'greeting') {
        context = `targetAudience: ${targetAudience}`;
      } else {
        context = "";
      }

      // 3. 組合 prompt
      const finalPrompt = `
[意圖] ${intent}
[背景資料] ${context}
[使用者問題] ${question}
請根據意圖與背景資料，給出最合適的回覆。
      `;

      // 4. 加入 user message 到 thread
      await openai.beta.threads.messages.create(thread_id, {
        role: "user",
        content: finalPrompt,
      });
      // 5. Assistant 回覆
      run = await openai.beta.threads.runs.create(thread_id, {
        assistant_id: ASSISTANT_ID,
      });
    }

    // 輪詢直到 assistant 回答完成
    let runStatus = run;
    while (runStatus.status !== "completed" && runStatus.status !== "failed") {
      await new Promise((r) => setTimeout(r, 1500));
      runStatus = await openai.beta.threads.runs.retrieve(thread_id, run.id);
    }

    if (runStatus.status === "failed") {
      return res.status(500).json({ error: "AI 助教回覆失敗" });
    }

    // 取得 assistant 回覆
    const messages = await openai.beta.threads.messages.list(thread_id);
    const assistantMessages = messages.data.filter((msg) => msg.role === "assistant");
    const latestMsg = assistantMessages[0];
    let answer = "";
    if (latestMsg) {
      answer = (latestMsg.content as Array<{ text: { value: string } }>).map((c) => c.text.value).join("\n");
    }

    // 回傳 thread id，前端要存下來
    res.status(200).json({ answer, threadId: thread_id });
  } catch (error) {
    console.error("Assistant API 錯誤：", error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message || "AI 助教回覆失敗" });
    } else {
      res.status(500).json({ error: "AI 助教回覆失敗" });
    }
  }
} 