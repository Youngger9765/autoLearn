import { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    feedback: "這是一段範例 AI 批改建議：內容結構清楚，論點明確，建議再補充更多細節與例子。",
  });
} 