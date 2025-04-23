module.exports = {
  extends: [
    'next/core-web-vitals', // Next.js 核心規則
    'plugin:@typescript-eslint/recommended', // TypeScript 推薦規則
    // 你可能還有其他的 extends，例如 'prettier'
  ],
  plugins: [
    '@typescript-eslint',
    // 你可能還有其他的 plugins
  ],
  parser: '@typescript-eslint/parser', // 指定 TypeScript 解析器
  parserOptions: {
    project: './tsconfig.json', // 指向你的 tsconfig 文件
  },
  rules: {
    // ... 其他規則
    '@typescript-eslint/no-explicit-any': 'off', // 完全關閉 any 檢查
    '@typescript-eslint/no-unused-vars': 'warn', // 將未使用變數降級為警告 (不會導致建置失敗)
    // 或者完全關閉: '@typescript-eslint/no-unused-vars': 'off',
  },
}; 