module.exports = {
  // ... 其他配置 (extends, plugins, etc.)
  rules: {
    // ... 其他規則
    '@typescript-eslint/no-explicit-any': 'off', // 完全關閉 any 檢查
    '@typescript-eslint/no-unused-vars': 'warn', // 將未使用變數降級為警告 (不會導致建置失敗)
    // 或者完全關閉: '@typescript-eslint/no-unused-vars': 'off',
  },
}; 