import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "只支援 POST" });
  const { sectionTitle, sectionContent } = req.body;
  if (!sectionTitle && !sectionContent) return res.status(400).json({ error: "缺少標題或內容參數" });

  // 直接回傳 mock 影片網址
  // 你可以用一個本地圖片路徑或一個固定字串
  // 例如：/mock-video.png 這張圖要放在 public 資料夾
  const videoUrl = "/mock-video.png";

  res.status(200).json({ videoUrl });
} 