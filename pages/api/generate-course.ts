import { NextApiRequest, NextApiResponse } from "next";
import supabase from '../../lib/supabase'; // 假設 lib 和 pages 在同一個父目錄下
import { v4 as uuidv4 } from 'uuid'; // 引入 UUID

// 定義前端傳來的資料結構 (根據之前的 API 和前端 state 推斷)
interface QuestionData {
  question_text: string;
  options: string[];
  answer: string; // 注意：使用 answer 而非 correct_answer，以匹配 generate-questions API 的回傳
  hint?: string;
}

interface SectionData {
  title: string;
  content: string;
  videoUrl?: string; // 前端 state 使用 videoUrl
  questions: QuestionData[];
}

interface CourseDataPayload {
  courseTitle: string; // 假設前端傳來 courseTitle
  prompt: string; // 原始的課程主題 prompt
  sections: SectionData[];
  userId?: string; // 可選的使用者 ID
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "只支援 POST" });
  }

  const { courseTitle, prompt, sections, userId }: CourseDataPayload = req.body;

  // 基本驗證
  if (!courseTitle || !prompt || !Array.isArray(sections) || sections.length === 0) {
    return res.status(400).json({ error: "缺少必要的課程資料：courseTitle, prompt 或 sections" });
  }

  try {
    const courseId = uuidv4(); // 產生課程 ID

    // 1. 寫入 courses 表
    const { error: courseError } = await supabase.from('courses').insert({
      id: courseId,
      title: courseTitle,
      prompt: prompt,
      user_id: userId || null // 如果有 userId 就寫入，否則為 null
    });

    if (courseError) {
      console.error("Supabase insert course error:", courseError);
      throw new Error(`寫入 courses 表失敗: ${courseError.message}`);
    }

    // 2. 遍歷 sections 並寫入 sections 和 questions 表
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const sectionId = uuidv4(); // 產生章節 ID

      // 寫入 sections 表
      const { error: sectionError } = await supabase.from('sections').insert({
        id: sectionId,
        course_id: courseId,
        title: sec.title,
        content: sec.content,
        youtube_url: sec.videoUrl || null, // 使用 videoUrl，如果沒有則為 null
        order_no: i // 章節順序
      });

      if (sectionError) {
        console.error(`Supabase insert section (order ${i}) error:`, sectionError);
        // 注意：這裡可以選擇是否要 rollback 或繼續，取決於業務邏輯
        // 為了簡單起見，我們先拋出錯誤停止流程
        throw new Error(`寫入 sections 表 (章節 ${i + 1}) 失敗: ${sectionError.message}`);
      }

      // 寫入 questions 表 (如果該章節有題目)
      if (sec.questions && Array.isArray(sec.questions) && sec.questions.length > 0) {
        const questionInserts = sec.questions.map(q => ({
          // question ID 由資料庫自動產生 (假設有設定 auto-increment 或 UUID default)
          // 或者也可以在這裡用 uuidv4() 產生
          section_id: sectionId,
          question_text: q.question_text,
          options: q.options,
          // 使用 q.answer 而非 q.correct_answer
          correct_answer: q.answer, // 將前端的 answer 對應到資料庫的 correct_answer 欄位
          hint: q.hint || null // 如果有 hint 就寫入
        }));

        const { error: questionError } = await supabase.from('questions').insert(questionInserts);

        if (questionError) {
          console.error(`Supabase insert questions for section (order ${i}) error:`, questionError);
          throw new Error(`寫入 questions 表 (章節 ${i + 1}) 失敗: ${questionError.message}`);
        }
      }
    }

    // 所有資料寫入成功，回傳 courseId
    res.status(200).json({ success: true, course_id: courseId });

  } catch (error) {
    console.error("Error in /api/generate-course:", error);
    const message = error instanceof Error ? error.message : "儲存課程時發生未知錯誤";
    // 回傳 500 Internal Server Error
    res.status(500).json({ error: message });
  }
} 