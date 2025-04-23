import { createClient } from '@supabase/supabase-js'

// 確保你的 .env.local 或 Vercel 環境變數中有設定這些值
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseAnonKey) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// 創建 Supabase client 實例
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 匯出 client 實例，以便在其他地方使用
export default supabase; 