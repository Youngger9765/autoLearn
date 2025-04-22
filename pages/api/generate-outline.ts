import { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "只支援 POST" });
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "缺少 prompt" });

  const sys_prompt = `你是一位課程設計師，請根據主題產生 5 個章節標題，只回傳 JSON 陣列格式，不要多餘說明：
["章節1標題", "章節2標題", ...]`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: sys_prompt },
        { role: "user", content: prompt }
      ],
      model: "gpt-4.1-mini"
    });
    const content = completion.choices[0].message.content;
    const outline = JSON.parse(content!);
    res.status(200).json({ outline });
  } catch (error) {
    res.status(500).json({ error: "產生大綱失敗" });
  }
} 