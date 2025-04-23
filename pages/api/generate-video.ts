import { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "只支援 POST" });
  const { sectionTitle, sectionContent, targetAudience } = req.body;
  if (!sectionTitle && !sectionContent) return res.status(400).json({ error: "缺少標題或內容參數" });

  let audienceText = "";
  if (targetAudience && targetAudience !== "other" && !isNaN(Number(targetAudience))) {
    audienceText = `，目標對象是「${targetAudience} 年級」`;
  } else if (targetAudience === "other") {
    audienceText = `，目標對象是「一般使用者」`;
  }
  const sys_prompt = `請根據章節「${sectionTitle}」${audienceText}${
    sectionContent ? `內容：「${sectionContent}」` : ""
  }，推薦一個最適合的 YouTube 影片，**只回傳影片網址，不要多餘說明**。`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: sys_prompt }
      ],
      model: "gpt-4.1-mini"
    });
    const content = completion.choices[0].message.content?.trim();
    // 只取第一個網址
    const urlMatch = content?.match(/https?:\/\/[^\s]+/);
    const videoUrl = urlMatch ? urlMatch[0] : "";
    res.status(200).json({ videoUrl });
  } catch {
    res.status(500).json({ error: "產生影片失敗" });
  }
} 