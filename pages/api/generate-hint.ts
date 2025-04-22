import { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "只支援 POST" });
  const { question, sectionContent } = req.body;
  if (!question || !sectionContent) return res.status(400).json({ error: "缺少參數" });

  const sys_prompt = `根據章節內容，針對這題「${question}」給一個簡短的提示，請用中文。`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: sys_prompt },
        { role: "user", content: sectionContent }
      ],
      model: req.body.model || "gpt-4.1-mini"
    });
    const hint = completion.choices[0].message.content?.trim();
    res.status(200).json({ hint });
  } catch {
    res.status(500).json({ error: "產生提示失敗" });
  }
} 