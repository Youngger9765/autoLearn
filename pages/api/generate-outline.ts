import type { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "只支援 POST 請求" });
    return;
  }

  const { prompt, numSections, targetAudience, customSectionTitles } = req.body;

  if (!prompt || !numSections) {
    res.status(400).json({ error: "缺少主題或章節數" });
    return;
  }

  let outline: string[] = [];
  if (Array.isArray(customSectionTitles) && customSectionTitles.some(t => t.trim())) {
    // 有自訂章節
    outline = customSectionTitles.map((t: string) => t.trim());
    // 找出需要 AI 產生的 index
    const needAIIdx = outline
      .map((t, idx) => (t ? null : idx))
      .filter(idx => idx !== null) as number[];

    if (needAIIdx.length > 0) {
      // 請 AI 產生剩餘章節標題
      const aiPrompt = `
請根據主題「${prompt}」${targetAudience ? `，目標年級：${targetAudience}` : ""}，產生${needAIIdx.length}個章節標題，避免重複，並以純文字陣列回傳（不需編號）。
${outline
  .map((t, i) => (t ? `第${i + 1}章：${t}` : ""))
  .filter(Boolean)
  .join("\n")}
      `.trim();

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "你是一個課程設計助理，請用繁體中文回覆。" },
          { role: "user", content: aiPrompt },
        ],
        temperature: 0.7,
      });

      // 假設 AI 回傳每行一個章節標題
      const aiTitles = completion.choices[0].message.content
        ?.split("\n")
        .map((t) => t.replace(/^[\d\.、章：:]+/, "").trim())
        .filter(Boolean);

      needAIIdx.forEach((idx, i) => {
        outline[idx] = aiTitles?.[i] || `章節${idx + 1}`;
      });
    }
    // 若全部自訂，AI 不會被呼叫
  } else {
    // 全部交給 AI 產生
    const aiPrompt = `
請根據主題「${prompt}」${targetAudience ? `，目標年級：${targetAudience}` : ""}，產生${numSections}個章節標題，避免重複，並以純文字陣列回傳（不需編號）。
    `.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "你是一個課程設計助理，請用繁體中文回覆。" },
        { role: "user", content: aiPrompt },
      ],
      temperature: 0.7,
    });

    outline = completion.choices[0].message.content
      ?.split("\n")
      .map((t) => t.replace(/^[\d\.、章：:]+/, "").trim())
      .filter(Boolean) || [];
  }

  res.status(200).json({ outline });
} 