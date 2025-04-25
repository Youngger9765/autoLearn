import { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "只支援 POST 請求" });
    return;
  }

  const {
    title,
    professionalContent,
    userText,
    domain,
    sectionTitle,
    sectionContent,
    essay,
  } = req.body;

  const finalTitle = title || sectionTitle;
  const finalProfessionalContent = professionalContent || sectionContent;
  const finalUserText = userText || essay;

  if (!finalTitle || !finalProfessionalContent || !finalUserText) {
    res.status(400).json({ error: "缺少 title、professionalContent 或 userText" });
    return;
  }

  try {
    const prompt = `
你是一位${domain || "該領域"}的專家老師，請根據以下資訊批改學生的段落，並給予具體建議。

【Section 標題】
${finalTitle}

【專業內容】
${finalProfessionalContent}

【學生輸入】
${finalUserText}

請以專業、具體的方式給予回饋與改進建議。
    `.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "你是一位專業的領域專家老師，請針對學生的回答給予批改與建議，主要判斷他是否學會這個章節的內容。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 512,
      temperature: 0.7,
    });

    const feedback = completion.choices[0].message?.content || "無法取得 AI 回覆";

    res.status(200).json({ feedback });
  } catch (error: unknown) {
    console.error("OpenAI API error:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : JSON.stringify(error) || "AI 批改失敗",
      fullError: error // 直接回傳整個 error 物件
    });
  }
}