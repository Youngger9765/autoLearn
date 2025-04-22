import { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "只支援 POST" });
  const { sectionTitle, courseTitle } = req.body;
  if (!sectionTitle || !courseTitle) return res.status(400).json({ error: "缺少參數" });

  const sys_prompt = `你是一位課程設計師，請針對課程「${courseTitle}」的章節「${sectionTitle}」產生 300 字以內的講義內容，只回傳純文字，不要多餘說明。`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: sys_prompt }
      ],
      model: "gpt-4.1-mini"
    });
    const content = completion.choices[0].message.content;
    res.status(200).json({ content });
  } catch {
    res.status(500).json({ error: "產生章節內容失敗" });
  }
} 