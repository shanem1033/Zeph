/** @type {import('jest').Config} */
module.exports = {
  // Use next/babel for JSX + ESM support
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // Don't treat helper files as tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/helpers/',
  ],

  // Don't transform node_modules except our mocked dependencies
  transformIgnorePatterns: ['/node_modules/'],
}
