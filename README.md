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

### 6.5 討論題（申論題）AI 批改與送出機制

- 每章節的討論題（申論題）支援 Markdown 編輯。
- 使用者可多次點擊「批改」按鈕，反覆取得 AI 的回饋建議，優化自己的答案。
- AI 回饋會即時顯示於下方，支援 Markdown 格式。
- 當使用者對答案滿意後，可點擊「送出」按鈕，將本次答案定案。
- 送出後，該章節的討論題輸入區與所有按鈕將被鎖定（不可再修改或批改），並於章節標題右側顯示「討論✅」。
- 若尚未送出，章節標題右側顯示「討論☐」。

### 6.6 練習題歷程（Quiz History）記錄與應用

- **記錄方式**：每當使用者在互動式練習題區塊作答並提交時，系統會將該題的題目、作答內容、正確與否、作答時間等資訊，依序記錄於 quizHistory 狀態（陣列）中。
- **資料結構**：
  ```typescript
  type QuizHistoryItem = {
    question: string;
    answers: {
      userAnswer: string;
      correct: boolean;
      timestamp: number;
    }[];
  };
  ```
- **前端傳遞**：quizHistory 狀態會隨每次 AI 助教提問一併傳遞給後端 API。
- **後端應用**：當 AI 助教判斷意圖為 `ask_quiz` 時，僅會將 quizHistory 中「最近一次作答紀錄」帶入 context，讓 AI 回饋能根據用戶最新的作答狀況給出個人化建議。
- **顯示方式**：使用者可隨時點擊右下角「做題歷程」按鈕，檢視所有作答紀錄，包含每題的答題狀態與時間。

### 6.7 課程大綱卡片（Outline Card）設計說明

課程大綱卡片（Outline Card）是課程產生頁面中，集中顯示課程 Banner、說明文件連結、以及課程大綱內容的區塊。其設計重點如下：

#### 1. 欄位與內容

- **Banner 圖片**  
  - 顯示於卡片最上方，預設為佔位圖（可自訂）。
  - 產生課程時會一併匯出/匯入。

- **說明文件（outlineDocs）**  
  - 支援多個網址欄位，可動態增減。
  - 每個欄位可輸入一個說明文件的 URL。
  - 可新增、刪除欄位，匯出/匯入時一併保存。

- **課程大綱內容（outlineContent）**  
  - 以 textarea 呈現，可手動輸入或由 AI 產生。
  - 支援自動調整高度，方便閱讀與編輯。
  - 產生課程時會一併匯出/匯入。

#### 2. 互動與 UX

- **AI 產生大綱**  
  - 右側有「🪄」按鈕，點擊可呼叫 AI 依據主題自動產生課程大綱內容，並自動填入 textarea。
  - 產生時顯示 loading 動畫，避免重複觸發。

- **已產生大綱（sections）**  
  - 若已產生章節，會以列表方式顯示於大綱卡片上方，方便對照。

- **說明文件欄位**  
  - 可動態增減，每個欄位右側有刪除按鈕。
  - 下方有「＋新增說明文件」按鈕。

- **Banner 圖片**  
  - 目前為靜態圖片，未來可支援上傳或更換。

#### 3. 產生流程與資料流

- 使用者可先手動輸入大綱內容，或點擊 AI 產生。
- 產生課程時，會將 outlineContent、outlineDocs、courseBanner 一併存入課程資料。
- 匯出/匯入課程時，這三個欄位會完整保存與還原。

#### 4. UI/UX 設計

- 卡片採用白底、圓角、陰影，與主頁風格一致。
- 各欄位間距適中，操作按鈕明顯。
- 支援響應式設計，於不同裝置下皆可良好顯示。

#### 5. 只讀模式

- 課程產生後，會於內容區塊頂部顯示唯讀版大綱卡片，方便學生快速瀏覽課程結構與說明文件。

---

## 7. AI 助教（Assistant）互動流程與設計說明

### 7.1 Assistant 運作流程

AI 助教（assistant）基於 OpenAI Assistant API，與使用者的互動採用「thread（對話串）」與「run（執行）」的設計。每次提問與回覆都會被記錄於 thread 之中，確保上下文連貫。

#### 主要流程如下：

1. **Thread 建立**
   - 使用者第一次開啟 AI 助教並提問時，系統會建立一個新的 thread，並將課程所有內容（allContent）與第一個問題組合成一則 user message，作為 thread 的開頭。
   - thread id 會回傳給前端，後續所有提問都會沿用同一個 thread id。

2. **Assistant Instruction 設定**
   - 在 thread 第一次建立時，會同時建立一個 run，run 會帶入 assistant 的 instruction。
   - instruction 內容包含 AI 助教的角色、回答規範、溝通風格、重要限制（如：嚴禁直接給練習題答案）、以及根據目標年級（targetAudience）調整語氣與深度。
   - instruction 只在 thread 第一次建立時設定，後續 run 不再重複設定。

3. **後續提問（有 thread id）**
   - 每次使用者提問時，系統會先進行「意圖分析」（intent analysis），判斷問題屬於哪一類（如：ask_quiz、ask_lecture、ask_video、ask_essay、greeting）。
   - 根據意圖，整理對應的 context：
     - `ask_quiz`：只帶入 quizHistory 的「最近一次做題紀錄」。
     - `ask_lecture`、`ask_video`、`ask_essay`：帶入對應章節內容。
     - `greeting`：帶入 targetAudience。
     - 其他：context 為空。
   - 組合 prompt 格式如下：
     ```
     [意圖] {intent}
     [背景資料] {context}
     [使用者問題] {question}
     請根據意圖與背景資料，給出最合適的回覆。
     ```
   - 將此 prompt 以 user message 形式加入 thread。

4. **Run 執行**
   - 每次新 user message 加入 thread 後，會建立一個新的 run，觸發 assistant 回覆。
   - run 會自動根據 thread 內容與 instruction 產生回應。

5. **回覆取得**
   - 系統會輪詢 run 狀態，直到 assistant 回覆完成。
   - 只取最新一則 assistant 回覆，回傳給前端顯示。

---

### 7.2 課程內容（allContent）與 targetAudience 加入時機

- **課程所有內容（allContent）**
  - **只在 thread 第一次建立時**，合併進 user message，作為 AI 助教的知識基礎。
  - 後續提問不再重複傳送 allContent，只根據意圖帶入必要 context（如 quizHistory、章節內容等）。

- **targetAudience**
  - **主要放在 run 的 instruction 裡**，讓 AI 助教根據學生背景調整語氣與深度。
  - instruction 內容會根據 targetAudience 組合出「請注意，學生的背景是……」等描述。
  - **greeting intent** 時，也會放進 context，讓 AI 助教能針對打招呼時給出適合的回應。

---

### 7.3 Assistant Instruction 範例

```text
你是一位課程 AI 助教。

[核心職責]
1. 利用上下文回答問題：每次提問都會附帶本次課程的所有內容（包含章節標題、講義、影片連結、練習題等），請根據這些最新的課程內容來回答學生的問題。
2. 結合課程結構：你也會收到課程的章節與內容摘要，請善用這些資訊，並在回答時適當引用或建議學生回顧相關章節。
3. 專注當前問題：優先針對學生當前的提問進行深入解答與討論。
4. 引導自主學習：如果問題涉及其他章節或知識點，可以引導學生回顧課程內容或探索其他章節。
5. 練習題輔導（嚴禁給答案）：如果學生提問與練習題相關，你的目標是引導他們思考、回顧相關知識點，**絕對禁止直接或間接提供答案或暗示答案**，鼓勵學生獨立解決問題。

[練習題]
- 根據課程內容，給予準確、相關的提示。
- 如果學生正在進行練習，幫助他們理解題意並給予適當提示，但不直接給答案。
- 如果學生回答了練習題，請根據他們的回答給予建設性回饋。
- 如果學生要求練習題，但課程中沒有預設題目，請根據課程內容即時創建一題合適的練習題（可為選擇題或問答題），並在學生作答後給予詳細解釋。
- 若學生多次嘗試仍無法正確作答，可適度提示，最後再給出正確答案並說明原因。

[溝通風格]
- 友善、耐心、鼓勵學生自主思考。
- 使用清晰、簡潔的語言。
- 適時使用 Markdown 格式化回答（如列表、粗體、程式碼區塊等）。

[重要限制]
- 嚴禁透露練習題答案或提供任何可能推導出答案的線索。
- 回答必須基於提供的課程內容，避免編造不相關資訊。
- 全程使用繁體中文（zh-TW）。
- 根據學生背景調整語氣與深度。
```

---

### 7.4 重要設計細節

- **thread id**：每個使用者/課程 session 對應一個 thread，確保上下文連貫。
- **run**：每次提問都會建立新的 run，觸發 assistant 回覆。
- **instruction**：只在 thread 建立時設定，後續 run 沿用，不重複設定。
- **context 精簡**：為避免 token 浪費，後續提問只帶入必要 context（如 quizHistory 最新紀錄），不再每次都傳送全部課程內容。
- **回覆唯一性**：只回傳最新一則 assistant 回覆，避免訊息重複。

---

### 7.5 前後端互動時序圖（簡易）

1. 使用者提問（第一次）→ 建立 thread + run（含 instruction，帶 allContent、targetAudience）→ assistant 回覆
2. 使用者提問（後續）→ 意圖分析 → context 整理（根據 intent 帶入 quizHistory/章節內容/targetAudience）→ user message 加入 thread → run → assistant 回覆

---

## 8. 參考資源

- [Next.js 官方文件](https://nextjs.org/docs)
- [React 官方文件](https://react.dev/)
- [Supabase 官方文件](https://supabase.com/docs)
- [OpenAI 官方文件](https://platform.openai.com/docs/)

---

## 9. 注意事項

- 請勿將 `.env.local` 上傳至公開版本庫。
- 若需擴充功能，請遵循現有 API 路由與資料格式設計。
- 若有其他第三方服務需求，請依照需求補充對應的環境變數。

---

## 10. User Story 與 Todo List

### 章節內容編輯（已完成功能 SPEC）
- 支援編輯章節標題（section title）
- 支援編輯章節講義內容（section content/lecture，支援 Markdown）
- 支援編輯章節影片連結或影片封面（videoUrl）
- 支援編輯練習題（題目文字、選項、答案、提示）
- 支援編輯討論題（題目說明、預設內容）
- 功能說明：可直接於前端介面編輯章節標題、講義內容（支援 Markdown 編輯器）、以及影片連結或封面。
- 規格：
  - 章節標題可即時修改，並於 UI 上即時反映。
  - 講義內容支援 Markdown 編輯與預覽。
  - 影片連結/封面可直接於前端介面編輯與預覽（支援 YouTube 連結或圖片）。
  - 編輯狀態有明顯提示，並可儲存或取消。

### 進度與成就
- [ ] 實作章節/課程進度條（User Story：學生希望看到自己的學習進度）
- [ ] 設計並實作成就徽章系統（User Story：學生完成目標時獲得成就感）

### 用戶回饋
- [ ] 提供用戶回饋表單並儲存資料（User Story：用戶希望能針對課程、AI 回覆或平台體驗給予回饋）

### 講義內容互動
- [ ] 實作講義內容重點標註工具列（User Story：學生希望可選取文字標註重點/取消重點）

### Google Drive 整合
- [ ] Google Drive OAuth 授權與課程儲存（User Story：老師希望將課程儲存到 Google Drive）
- [ ] Google Drive 課程讀取與載入（User Story：老師希望從 Google Drive 讀取課程）

### 用戶與課程管理
- [ ] 用戶註冊與登入（含第三方登入）（User Story：用戶希望註冊/登入保護學習資料）
- [ ] 課程收藏功能（User Story：已登入用戶希望收藏課程）

### 課程分享與學生端
- [ ] 課程分享連結產生與權限管理（User Story：老師希望產生課程連結分享給學生）
- [ ] 學生端課程學習入口（User Story：學生可透過連結直接進入課程學習）

### 章節內容編輯
- [ ] 編輯後內容可同步匯出/匯入（JSON 結構需支援最新內容）
- [ ] 權限控管（僅課程建立者或有權限者可編輯，學生端僅可檢視）

## 已完成功能（SPEC 歸檔）

### 課程 JSON 匯出/匯入
- **功能說明**：可將目前課程內容（包含主題、章節、內容型別、練習題、討論題、Banner、說明文件等）匯出為 JSON 檔案，亦可從 JSON 檔案還原課程進度。
- **規格**：
  - 匯出時包含所有課程設定與互動歷程。
  - 匯入時自動還原所有欄位與狀態。
  - 支援錯誤格式提示。

### AI 助教（Assistant）互動
- **功能說明**：課程產生後，右下角可展開 AI 助教，針對課程內容即時提問，獲得 AI 回覆。
- **規格**：
  - 採用 OpenAI Assistant API，支援 thread/run 機制。
  - 首次提問帶入所有課程內容，後續僅帶必要 context。
  - 回覆支援 Markdown 格式，嚴禁直接給練習題答案。
  - 可隨時關閉/展開助教視窗。

### 練習題歷程（Quiz History）
- **功能說明**：每次作答都會記錄於 quizHistory，並可隨時檢視所有作答紀錄。
- **規格**：
  - 每題記錄所有作答（答案、正確與否、時間）。
  - 可於右下角「做題歷程」按鈕檢視。
  - 前端 quizHistory 狀態會傳遞給 AI 助教，後端根據意圖帶入 context。

### 討論題（申論題）AI 批改與送出
- **功能說明**：每章節有討論題，支援 Markdown 編輯，送出後由 AI 給予回饋建議。
- **規格**：
  - 可多次批改，直到送出為止。
  - 送出後該章節討論題鎖定，顯示「討論✅」。
  - AI 回饋支援 Markdown 格式。

### 進度條與骨架屏動畫
- **功能說明**：課程產生過程有進度條顯示與骨架屏動畫，提升用戶體驗。
- **規格**：
  - 進度條顯示目前產生進度（步驟/百分比）。
  - 骨架屏動畫於資料載入中顯示。

### 課程大綱卡片（Outline Card）
- **功能說明**：集中顯示課程 Banner、說明文件連結、課程大綱內容，支援 AI 產生與手動編輯。
- **規格**：
  - Banner 圖片、說明文件（多個 URL）、大綱內容（textarea，自動調整高度）。
  - 支援 AI 產生大綱、動態增減說明文件欄位。
  - 產生課程時一併匯出/匯入。
  - 內容區塊頂部顯示唯讀版大綱卡片。

---

## 11. 近期更新紀錄

### 2025-04-30

- **章節內容編輯 SPEC 歸檔優化**
  - 已完成的「章節內容編輯」功能（標題、講義、影片、練習題、討論題等）自 TODO List 移至 SPEC 歸檔，並於 User Story 區塊上方集中呈現，讓未完成項目與已完成功能明確分離。
- **README TODO 清理**
  - 只保留尚未完成的章節內容編輯相關 TODO，移除重複與已完成項目，提升專案進度追蹤的清晰度。

### 2025-04-29

- **AI 助教支援意圖分析（Intent Analysis）與 Context 精準整理**
  - 後端 `/api/chat.ts` 先判斷使用者問題意圖（如 ask_quiz、ask_lecture、greeting 等），再根據意圖決定 context。
- **練習題互動優化與用戶歷程整合**
  - 若意圖為 `ask_quiz`，AI 助教 context 只會帶入「用戶最近一次做題歷程」，讓回饋更個人化、更精準。
  - 前端 `quizHistory` 狀態已正確傳遞到 AI 助教，並同步型別定義，避免 any。
- **TypeScript 型別強化**
  - 移除 any，明確定義 `QuizHistoryItem` 型別，前後端一致。
  - 修正 API 端 map 參數型別，解決 TS 報錯。
- **修正 AI 助教回覆重複顯示的問題**
  - 只顯示最新一則 assistant 回覆，不再串接所有歷史訊息。
- 其他小幅優化與錯誤處理。

---

### Mock Data 移除與真實資料串接 TODO

- [ ] 影片產生 API（`/api/generate-video.ts`）目前僅回傳 mock 圖片 `/mock-video.png`，**尚未串接 YouTube Data API 或真實影片來源**。  
  - 待辦：改為根據章節內容自動搜尋/產生 YouTube 影片連結，或支援自訂影片上傳/嵌入。

- [ ] 課程大綱卡片 Banner（outline banner）目前僅使用預設靜態圖片（mock），**尚未支援自訂上傳或真實圖片來源**。  
  - 待辦：改為可上傳自訂圖片，或支援從外部來源取得 Banner。

---
