/** @type {import('jest').Config} */
module.exports = {
  // Use next/babel for JSX + ESM support
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // Look for tests in the root test/ folder
  roots: ['<rootDir>/../../test'],

  // Don't treat helper files as tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '/test/helpers/',
    'Compensation\\.test\\.cjs',
  ],

  // Don't transform node_modules except our mocked dependencies
  transformIgnorePatterns: ['/node_modules/'],

  // Ensure node_modules from src/web are resolved for tests outside src/web
  modulePaths: ['<rootDir>/node_modules'],
}
