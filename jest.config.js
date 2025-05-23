/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['/node_modules/', '/cypress/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^react-syntax-highlighter/dist/esm/styles/prism/.*$': '<rootDir>/__mocks__/styleMock.js',
    'react-markdown': '<rootDir>/__mocks__/ReactMarkdown.js',
    'remark-gfm': '<rootDir>/__mocks__/remarkGfm.js',
  },
};

module.exports = createJestConfig(customJestConfig);
