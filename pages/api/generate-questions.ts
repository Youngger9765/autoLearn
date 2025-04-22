import { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "只支援 POST" });
  const { sectionTitle, sectionContent } = req.body;
  if (!sectionTitle || !sectionContent) return res.status(400).json({ error: "缺少參數" });

  const sys_prompt = `你是一位課程設計師，請針對章節「${sectionTitle}」內容，產生 2 題選擇題，回傳 JSON 格式：
[
  {
    "question_text": "題目",
    "options": ["選項1", "選項2", ...],
    "answer": "正確答案的選項內容",
    "hint": "簡短提示"
  }
]
只回傳 JSON，不要多餘說明。`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: sys_prompt },
        { role: "user", content: sectionContent }
      ],
      model: "gpt-4.1-mini"
    });
    const content = completion.choices[0].message.content;
    const questions = JSON.parse(content!);
    res.status(200).json({ questions });
  } catch {
    res.status(500).json({ error: "產生題目失敗" });
  }
} 