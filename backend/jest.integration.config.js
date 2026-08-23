const base = require('./jest.config');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  testMatch: ['**/*.integration.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFiles: ['<rootDir>/test/setupTestEnv.js'],
  globalSetup: '<rootDir>/test/globalSetup.js',
  testTimeout: 20000,
};
