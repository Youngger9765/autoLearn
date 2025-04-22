import { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "只支援 POST 請求" });
    return;
  }

  const { prompt } = req.body;

  if (!prompt) {
    res.status(400).json({ error: "缺少 prompt 參數" });
    return;
  }

  const sys_prompt = `你是一位課程設計師，根據使用者輸入的主題，幫我產生課程，請用以下 JSON 格式回傳（key 請用英文）：

{
  "title": "課程標題",
  "sections": [
    {
      "id": 章節編號,
      "title": "章節標題",
      "content": "講義內容",
      "youtube_url": "推薦影片 YouTube URL",
      "questions": [
        {
          "question_text": "題目",
          "options": ["選項1", "選項2", ...]
        }
      ]
    }
  ]
}

課程需包含：
1. 課程標題
2. 5~7 個章節，每章包含標題、講義內容、推薦影片 YouTube URL
3. 每章 1~2 題選擇題，題幹與選項要清楚
`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: sys_prompt },
        { role: "user", content: prompt }
      ],
      model: "gpt-4.1"
    });

    const content = completion.choices[0].message.content;
    console.log("GPT 回傳內容：", content);

    let data;
    try {
      data = JSON.parse(content!);
    } catch {
      return res.status(500).json({ error: "AI 回傳格式錯誤，請重試" });
    }

    if (data["課程標題"] && data["章節"]) {
      data = {
        title: data["課程標題"],
        sections: (data["章節"] || []).map((sec: Record<string, unknown>, idx: number) => ({
          id: idx,
          title: sec["標題"] as string,
          content: sec["講義內容"] as string,
          youtube_url: sec["推薦影片"] as string,
          questions: (sec["選擇題"] as Array<Record<string, unknown>> || []).map((q) => ({
            question_text: q["題目"] as string,
            options: q["選項"] as string[]
          }))
        }))
      };
    }

    res.status(200).json(data);
  } catch (error: any) {
    console.error("API 產生課程錯誤：", error);
    res.status(500).json({ error: error.message || "產生課程時發生錯誤" });
  }
} 