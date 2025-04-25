# AI 課程產生器

本專案是一個基於 Next.js 的 AI 課程產生平台，提供自動化課程大綱、章節內容、教學影片、練習題與討論題的產生，並整合 AI 助教互動功能。適合教育工作者、學生或自學者快速建立個人化學習內容。

---

## 1. 專案簡介

- 前端：Next.js + React
- 後端：TypeScript (API Routes)
- AI 服務：OpenAI API
- 其他：Supabase、YouTube Data API

---

## 2. 主要功能

- **AI 課程產生**：依主題自動產生課程大綱、章節內容、影片、練習題、討論題。
- **課程設定**：可自訂主題、目標年級、章節數、章節名稱、內容型別、題目型態等。
- **AI 助教**：課程產生後可即時提問，獲得 AI 回覆。
- **互動式練習題**：支援選擇題、是非題，答題即時批改、提示、回饋。
- **討論題 AI 批改**：Markdown 編輯，送出後由 AI 給予建議。
- **進度條與骨架屏**：產生過程有進度顯示與骨架屏動畫。

---

## 2.1 主要技術與套件

- **Next.js**：React 應用框架，支援 SSR 與 API Routes。
- **React**：前端 UI 框架。
- **TypeScript**：靜態型別語言，提升開發可靠性。
- **@uiw/react-md-editor**：Markdown 編輯器，支援討論題與申論題輸入。
- **react-markdown**：Markdown 解析與渲染。
- **react-syntax-highlighter**：程式碼區塊語法高亮。
- **axios**：HTTP 請求工具（用於與 API 溝通）。
- **Supabase**：雲端資料庫與認證服務。
- **OpenAI API**：AI 內容生成、批改與聊天。
- **YouTube Data API**：影片相關功能（如有）。

---

## 3. 目錄結構

- `pages/generate.tsx`：課程設定與產生主頁
- `pages/api/generate-outline.ts`：產生課程大綱 API
- `pages/api/generate-video.ts`：產生影片 API
- `pages/api/grade-essay.ts`：AI 批改申論題 API
- `pages/api/chat.ts`：AI 助教聊天 API
- `.env.local`：環境變數設定

---

## 4. 安裝與啟動

```bash
npm install
npm run dev
```

瀏覽器開啟 [http://localhost:3000](http://localhost:3000) 查看效果。

---

## 5. 環境變數設定

請於專案根目錄建立 `.env.local`，並依下列格式填入對應的金鑰與參數：

```env
NEXT_PUBLIC_SUPABASE_URL=你的_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_SUPABASE_ANON_KEY
OPENAI_API_KEY=你的_OPENAI_API_KEY
```

- `NEXT_PUBLIC_SUPABASE_URL`：Supabase 專案的 URL。
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`：Supabase 匿名金鑰。
- `OPENAI_API_KEY`：OpenAI API 金鑰，用於 AI 相關功能。

---

## 6. 課程設定與產生流程

### 6.1 課程設定項目

- **課程主題或敘述**：輸入你想學習的主題（如「Python 入門」、「數據分析基礎」）。
- **目標年級**：可複選，支援國小低年級、國小中年級、國小高年級、國中生、高中生、大學生、社會人士。
- **章節數**：可自訂 3~10 章。
- **自訂章節名稱**：每章可自訂標題，留空則由 AI 自動產生。
- **內容型別**：可選擇、排序、刪除、或新增「講義」、「影片」、「練習題」、「討論」等內容型別。
- **每章題數**：若有選擇「練習題」，可設定每章題目數量（1~5 題）。
- **題目型態**：可複選「選擇題」、「是非題」。

### 6.2 產生流程

1. **設定課程參數**：依需求填寫主題、年級、章節數、內容型別等。
2. **點擊「開始產生課程」**：AI 依據設定自動產生課程大綱、章節內容、影片連結、練習題與討論題。
3. **進度條顯示產生進度**，過程中可見骨架屏動畫。
4. **產生完成後**，每章節會依內容型別顯示：
   - **講義**：支援 Markdown 格式，含語法高亮。
   - **影片**：顯示影片縮圖或連結。
   - **練習題**：互動式選擇題/是非題，支援即時批改、提示、答對/答錯回饋。
   - **討論題**：支援 Markdown 編輯，送出後由 AI 批改並給予建議。

### 6.3 AI 助教功能

- 產生課程後，右下角會出現「AI 助教」浮動按鈕。
- 點擊可展開 AI 助教視窗，針對課程內容即時提問，獲得 AI 回覆。

### 6.4 互動與 UX

- 所有設定區塊可收合/展開，方便專注於課程內容。
- 支援拖曳排序內容型別、動態增減型別。
- 章節內容可展開/收合，便於瀏覽。
- 練習題與討論題皆有即時互動與 AI 回饋。

---

## 7. 參考資源

- [Next.js 官方文件](https://nextjs.org/docs)
- [React 官方文件](https://react.dev/)
- [Supabase 官方文件](https://supabase.com/docs)
- [OpenAI 官方文件](https://platform.openai.com/docs/)

---

## 8. 注意事項

- 請勿將 `.env.local` 上傳至公開版本庫。
- 若需擴充功能，請遵循現有 API 路由與資料格式設計。
- 若有其他第三方服務需求，請依照需求補充對應的環境變數。

---

## 9. MVP 學習體驗優化 TODO

- [ ] 課程產生流程流暢化與錯誤處理
- [ ] 章節內容展開/收合與 Markdown 顯示優化
- [ ] 練習題即時批改與提示
- [ ] 討論題 AI 批改回饋具體化
- [ ] AI 助教上下文與互動優化
- [ ] 學習進度條與成就感設計
- [ ] 用戶回饋機制

---
