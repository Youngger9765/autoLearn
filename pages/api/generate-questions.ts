import { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "只支援 POST" });
  const {
    sectionTitle,
    sectionContent,
    targetAudience,
    selectedQuestionTypes: typesString,
    numQuestions = 2
  } = req.body;
  if (!sectionTitle || !sectionContent) return res.status(400).json({ error: "缺少標題或內容參數" });

  let selectedQuestionTypes: string[] = [];
  if (typeof typesString === 'string' && typesString.trim() !== '') {
    selectedQuestionTypes = typesString.split(',')
                                     .map(type => type.trim())
                                     .filter(type => type);
  }

  if (selectedQuestionTypes.length === 0) {
    selectedQuestionTypes = ["multiple_choice"];
  }

  if (typeof numQuestions !== 'number' || numQuestions < 1 || numQuestions > 5) {
    return res.status(400).json({ error: "題數必須介於 1 到 5 之間" });
  }

  let audienceText = "";
  if (targetAudience && targetAudience !== "other" && !isNaN(Number(targetAudience))) {
    audienceText = `，目標對象是「${targetAudience} 年級」`;
  } else if (targetAudience === "other") {
    audienceText = `，目標對象是「一般使用者」`;
  }

  const typeMapping: { [key: string]: string } = {
    "multiple_choice": "選擇題",
    "true_false": "是非題"
  };
  const requestedTypesText = selectedQuestionTypes.map(type => typeMapping[type] || type).join("、");
  const instructionText = selectedQuestionTypes.length > 1 ? `，請混合包含這幾種題型：${requestedTypesText}` : `，題型請用 ${requestedTypesText}`;

  const sys_prompt = `你是一位課程設計師，請針對章節「${sectionTitle}」內容${audienceText}，產生 ${numQuestions} 題測驗題${instructionText}。回傳 JSON 格式：
[
  {
    "question_text": "題目",
    "options": ["選項1", "選項2", ...],
    "answer": "正確答案的選項內容",
    "hint": "簡短提示"
  }
]
只回傳 JSON，不要多餘說明。對於是非題，選項固定為 ["是", "否"]，答案也必須是 "是" 或 "否"。`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: sys_prompt },
        { role: "user", content: sectionContent }
      ],
      model: "gpt-4.1-mini"
    });
    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("OpenAI 回傳內容為空");
    }
    let questions;
    try {
      questions = JSON.parse(content);
    } catch (_parseError) {
      console.error("Failed to parse OpenAI response:", content);
      throw new Error("無法解析 AI 回傳的 JSON 格式!");
    }
    if (!Array.isArray(questions)) {
       console.error("Parsed response is not an array:", questions);
       throw new Error("AI 回傳的格式不是預期的陣列");
    }

    res.status(200).json({ questions });
  } catch (error) {
    console.error("Error generating questions:", error);
    const message = error instanceof Error ? error.message : "產生題目失敗";
    res.status(500).json({ error: message });
  }
} 