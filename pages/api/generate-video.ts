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

  // 直接回傳 mock 影片網址
  // 你可以用一個本地圖片路徑或一個固定字串
  // 例如：/mock-video.png 這張圖要放在 public 資料夾
  const videoUrl = "/mock-video.png";

  res.status(200).json({ videoUrl });
} 