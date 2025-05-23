import 'openai/shims/node';
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

  // 判斷是否為「結構化大綱說明」的請求（魔法棒）
  const isStructuredOutline = !!req.body.outlineMagic;
  let outline: string[] = [];
  let outlineContent: string | undefined = undefined;

  if (isStructuredOutline) {
    // 組合結構化大綱 prompt，明確說明已知變數
    const magicPrompt = `
請根據以下課程設定，產生一份結構化的課程大綱說明，格式請參考範例：
一、課程大綱與說明
• 設定對象：${targetAudience?.join("、") || "未指定"}
（本欄位已由使用者指定，請直接引用）

二、課程內容
【課程名稱】
• ${prompt || "未指定"}
（本欄位已由使用者指定，請直接引用）
【課程大綱】
請用條列式（每點前加「•」或「-」）列出本課程的章節標題：
${Array.isArray(customSectionTitles) && customSectionTitles.length > 0 && customSectionTitles.some(t => t.trim())
  ? customSectionTitles.filter(t => t.trim()).map(t => `• ${t.trim()}`).join('\n')
  : "未指定"
}
（如有已知章節標題，請直接引用，否則請 AI 產生）
【課程目標】
1. 請列出 2-4 點本課程的學習目標
【課程特色】
✅ 請列出 2-4 點本課程的特色，建議用 emoji 開頭
請用條列式、分段清楚地產生內容，並根據設定自動填寫。
`;
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "你是一個課程設計助理，請用繁體中文回覆。" },
        { role: "user", content: magicPrompt },
      ],
      temperature: 0.7,
    });
    outlineContent = completion.choices[0].message.content?.trim() || "";
    outline = [];
    res.status(200).json({ outline, outlineContent });
    return;
  }

  // === 原本的章節標題產生邏輯 ===
  if (Array.isArray(customSectionTitles) && customSectionTitles.some(t => t.trim())) {
    outline = customSectionTitles.map((t: string) => t.trim());
    const needAIIdx = outline
      .map((t, idx) => (t ? null : idx))
      .filter(idx => idx !== null) as number[];
    if (needAIIdx.length > 0) {
      const aiPrompt = `
請根據主題「${prompt}」${targetAudience ? `，目標年級：${targetAudience}` : ""}，產生${needAIIdx.length}個章節標題，避免重複，並以純文字陣列回傳（不需編號）。
${outline
  .map((t, i) => (t ? `第${i + 1}章：${t}` : ""))
  .filter(Boolean)
  .join("\n")}
      `.trim();
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: "你是一個課程設計助理，請用繁體中文回覆。" },
          { role: "user", content: aiPrompt },
        ],
        temperature: 0.7,
      });
      const aiTitles = completion.choices[0].message.content
        ?.split("\n")
        .map((t) => t.replace(/^[\d\.、章：:]+/, "").trim())
        .filter(Boolean);
      needAIIdx.forEach((idx, i) => {
        outline[idx] = aiTitles?.[i] || `章節${idx + 1}`;
      });
    }
  } else {
    const aiPrompt = `
請根據主題「${prompt}」${targetAudience && targetAudience.length ? `，目標年級：${targetAudience.join("、")}` : ""}，產生${numSections}個章節標題，避免重複，並以純文字陣列回傳（不需編號）。
    `.trim();
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "你是一個課程設計助理，請用繁體中文回覆。" },
        { role: "user", content: aiPrompt },
      ],
      temperature: 0.7,
    });
    const content = completion.choices[0].message.content?.trim() || "";
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        outline = parsed.map((t) => String(t).replace(/^[\d\.、章：:]+/, "").trim()).filter(Boolean);
      }
    } catch {
      outline = content
        .split("\n")
        .map((t) => t.replace(/^[\d\.、章：:]+/, "").trim())
        .filter((t) =>
          t &&
          !/^(Sure|以下|希望|這些|章節標題|幫助|主題|標題|^$)/i.test(t) &&
          !/^[\[\]{}"']+$/.test(t)
        )
        .slice(0, Number(numSections));
    }
  }
  res.status(200).json({ outline });
} 