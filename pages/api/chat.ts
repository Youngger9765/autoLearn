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

  const { allContent, question, threadId } = req.body;

  if (!allContent || !question) {
    res.status(400).json({ error: "缺少課程內容或提問" });
    return;
  }

  try {
    let thread_id = threadId;

    // 1. 若沒有 thread id，建立新 thread 並回傳
    if (!thread_id) {
      const thread = await openai.beta.threads.create({
        messages: [
          {
            role: "user",
            content: question,
          },
        ],
      });
      thread_id = thread.id;
    } else {
      // 有 thread id，直接新增訊息
      await openai.beta.threads.messages.create(thread_id, {
        role: "user",
        content: question,
      });
    }

    // 2. 執行 assistant
    let run;
    if (!threadId) {
      // 第一次提問，傳 instructions
      run = await openai.beta.threads.runs.create(thread_id, {
        assistant_id: ASSISTANT_ID,
        instructions: `以下是本次課程的所有內容，請根據這些內容回答學生問題，若內容不足請誠實說明：\n${allContent}`,
      });
    } else {
      // 之後提問，不傳 instructions
      run = await openai.beta.threads.runs.create(thread_id, {
        assistant_id: ASSISTANT_ID,
      });
    }

    // 3. 輪詢直到 assistant 回答完成
    let runStatus = run;
    while (runStatus.status !== "completed" && runStatus.status !== "failed") {
      await new Promise((r) => setTimeout(r, 1500));
      runStatus = await openai.beta.threads.runs.retrieve(thread_id, run.id);
    }

    if (runStatus.status === "failed") {
      return res.status(500).json({ error: "AI 助教回覆失敗" });
    }

    // 4. 取得 assistant 回覆
    const messages = await openai.beta.threads.messages.list(thread_id);
    const answer = messages.data
      .filter((msg) => msg.role === "assistant")
      .map((msg) =>
        (msg.content as Array<{ text: { value: string } }>).map((c) => c.text.value).join("\n")
      )
      .join("\n");

    // 回傳 thread id，前端要存下來
    res.status(200).json({ answer, threadId: thread_id });
  } catch (error: any) {
    console.error("Assistant API 錯誤：", error);
    res.status(500).json({ error: error.message || "AI 助教回覆失敗" });
  }
} 