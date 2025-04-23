import { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "只支援 POST" });
  const { sectionTitle, courseTitle, targetAudience } = req.body;
  if (!sectionTitle || !courseTitle) return res.status(400).json({ error: "缺少標題參數" });

  let audienceText = "";
  if (targetAudience && targetAudience !== "other" && !isNaN(Number(targetAudience))) {
    audienceText = `，目標對象是「${targetAudience} 年級」`;
  } else if (targetAudience === "other") {
    audienceText = `，目標對象是「一般使用者」`; // 或其他通用描述
  }
  const sys_prompt = `你是一位課程設計師，請針對課程「${courseTitle}」的章節「${sectionTitle}」${audienceText}產生 300 字以內的講義內容。內容請盡量使用 markdown 語法（如標題、粗體、列點、程式區塊等），只回傳純 markdown，不要多餘說明。`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: sys_prompt }
      ],
      model: req.body.model || "gpt-4.1-mini"
    });
    const content = completion.choices[0].message.content;
    res.status(200).json({ content });
  } catch {
    res.status(500).json({ error: "產生章節內容失敗" });
  }
} 