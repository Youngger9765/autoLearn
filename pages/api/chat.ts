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

      // run 指令只需要說明回答語言
      run = await openai.beta.threads.runs.create(thread_id, {
        assistant_id: ASSISTANT_ID,
      });
    } else {
      // 之後提問，先加 user message，再 run
      await openai.beta.threads.messages.create(thread_id, {
        role: "user",
        content: question,
      });
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
  } catch (error) {
    console.error("Assistant API 錯誤：", error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message || "AI 助教回覆失敗" });
    } else {
      res.status(500).json({ error: "AI 助教回覆失敗" });
    }
  }
} 