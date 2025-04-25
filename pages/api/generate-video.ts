import { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 新增一個檢查 YouTube 影片是否存在的函式
async function checkYouTubeVideoExists(videoId: string): Promise<boolean> {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}`
    try {
        const res = await fetch(url)
        return res.ok
    } catch {
        return false
    }
}

// 新增一個正確擷取 YouTube videoId 的函式
function extractYouTubeVideoId(url: string): string | null {
    if (!url) return null;
    // 處理 youtu.be/xxxx
    let match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    // 處理 youtube.com/watch?v=xxxx
    match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    // 處理 embed/xxxx
    match = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    return null;
}

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
  const  = `請根據章節「${sectionTitle}」${audienceText}${
    sectionContent ? `內容：「${sectionContent}」` : ""
  }，推薦一個最適合的 YouTube 影片，**只回傳影片網址，不要多餘說明**。`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: user_prompt }
      ],
      model: "gpt-4.1-mini"
    });
    const content = completion.choices[0].message.content?.trim();
    // 只取第一個網址
    const urlMatch = content?.match(/https?:\/\/[^\s]+/);
    const videoUrl = urlMatch ? urlMatch[0] : "";

    // 用正則式正確擷取 videoId
    const videoId = extractYouTubeVideoId(videoUrl);
    if (!videoId) {
        return res.status(400).json({ error: '無法解析 YouTube 影片 ID' });
    }

    // 檢查影片是否存在
    const exists = await checkYouTubeVideoExists(videoId);
    if (!exists) {
        return res.status(404).json({ error: 'YouTube 影片不存在' });
    }

    res.status(200).json({ videoUrl });
  } catch {
    res.status(500).json({ error: "產生影片失敗" });
  }
} 